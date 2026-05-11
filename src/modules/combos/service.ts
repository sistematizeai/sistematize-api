import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';

const COMBO_SELECT = '*, combo_services(id, service_id, service:services(id, name, price, duration_minutes, is_active))';

export async function listCombos(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('combos')
    .select(COMBO_SELECT)
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getCombo(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('combos')
    .select(COMBO_SELECT)
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Combo nao encontrado.');
    throw error;
  }
  return data;
}

export async function createCombo(businessId: string, input: {
  name: string;
  description?: string;
  price?: number;
  discount_percent?: number;
  duration_minutes?: number;
  is_active?: boolean;
  sort_order?: number;
  service_ids?: string[];
}) {
  const supabase = getSupabaseAdmin();
  const { service_ids, ...comboData } = input;

  // Insert the combo
  const { data: combo, error } = await supabase
    .from('combos')
    .insert({ business_id: businessId, ...comboData })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') throw new ConflictError('Ja existe um combo com esse nome.');
    throw error;
  }

  // Validate price against service totals if both price and service_ids are provided
  if (service_ids && service_ids.length > 0 && input.price !== undefined) {
    const { data: svcPrices } = await supabase
      .from('services')
      .select('price')
      .in('id', service_ids)
      .eq('business_id', businessId);

    if (svcPrices) {
      const totalServicePrice = svcPrices.reduce((sum, s) => sum + (s.price || 0), 0);
      if (input.price > totalServicePrice) {
        await supabase.from('combos').delete().eq('id', combo.id);
        throw new ValidationError(`Preco do combo (${input.price}) nao pode ser maior que a soma dos servicos (${totalServicePrice}).`);
      }
    }
  }

  // Insert combo_services if provided
  if (service_ids && service_ids.length > 0) {
    const { data: validServices } = await supabase
      .from('services')
      .select('id')
      .in('id', service_ids)
      .eq('business_id', businessId);

    if (!validServices || validServices.length !== service_ids.length) {
      await supabase.from('combos').delete().eq('id', combo.id);
      throw new ValidationError('Um ou mais servicos nao pertencem a este estabelecimento.');
    }

    const comboServices = service_ids.map((service_id) => ({
      combo_id: combo.id,
      service_id,
    }));

    const { error: csError } = await supabase
      .from('combo_services')
      .insert(comboServices);

    if (csError) {
      // Rollback: delete the combo if service linking fails
      await supabase.from('combos').delete().eq('id', combo.id);
      if (csError.code === '23503') throw new NotFoundError('Um ou mais servicos nao foram encontrados.');
      throw csError;
    }
  }

  // Return the full combo with services
  return getCombo(combo.id, businessId);
}

export async function updateCombo(id: string, businessId: string, input: {
  name?: string;
  description?: string;
  price?: number;
  discount_percent?: number;
  duration_minutes?: number;
  is_active?: boolean;
  sort_order?: number;
  service_ids?: string[];
}) {
  const supabase = getSupabaseAdmin();
  const { service_ids, ...comboData } = input;

  if (Object.keys(comboData).length === 0) {
    const { error: checkErr } = await supabase
      .from('combos').select('id').eq('id', id).eq('business_id', businessId).single();
    if (checkErr) {
      if (checkErr.code === 'PGRST116') throw new NotFoundError('Combo nao encontrado.');
      throw checkErr;
    }
  }

  // Update the combo fields (only if there are fields to update)
  if (Object.keys(comboData).length > 0) {
    const { error } = await supabase
      .from('combos')
      .update(comboData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw new ConflictError('Ja existe um combo com esse nome.');
      if (error.code === 'PGRST116') throw new NotFoundError('Combo nao encontrado.');
      throw error;
    }
  }

  if (service_ids !== undefined) {
    if (service_ids.length > 0) {
      const { data: validServices } = await supabase
        .from('services').select('id, price').in('id', service_ids).eq('business_id', businessId);

      if (!validServices || validServices.length !== service_ids.length) {
        throw new ValidationError('Um ou mais servicos nao pertencem a este estabelecimento.');
      }

      const priceToCheck = input.price ?? (await supabase.from('combos').select('price').eq('id', id).single()).data?.price;
      if (priceToCheck !== undefined && priceToCheck !== null) {
        const totalServicePrice = validServices.reduce((sum, s) => sum + (s.price || 0), 0);
        if (Number(priceToCheck) > totalServicePrice) {
          throw new ValidationError(`Preco do combo (${priceToCheck}) nao pode ser maior que a soma dos servicos (${totalServicePrice}).`);
        }
      }
    }

    const { error: delError } = await supabase
      .from('combo_services')
      .delete()
      .eq('combo_id', id);

    if (delError) throw delError;

    if (service_ids.length > 0) {
      const comboServices = service_ids.map((service_id) => ({
        combo_id: id,
        service_id,
      }));

      const { error: csError } = await supabase
        .from('combo_services')
        .insert(comboServices);

      if (csError) {
        if (csError.code === '23503') throw new NotFoundError('Um ou mais servicos nao foram encontrados.');
        throw csError;
      }
    }
  } else if (input.price !== undefined) {
    const { data: currentServices } = await supabase
      .from('combo_services')
      .select('service:services(price)')
      .eq('combo_id', id);
    if (currentServices && currentServices.length > 0) {
      const totalServicePrice = currentServices.reduce((sum, cs: any) => sum + (cs.service?.price || 0), 0);
      if (input.price > totalServicePrice) {
        throw new ValidationError(`Preco do combo (${input.price}) nao pode ser maior que a soma dos servicos (${totalServicePrice}).`);
      }
    }
  }

  // Return the full combo with services
  return getCombo(id, businessId);
}

export async function uploadComboImage(id: string, businessId: string, fileBuffer: Buffer, mimeType: string) {
  const supabase = getSupabaseAdmin();

  const { error: existErr } = await supabase
    .from('combos').select('id').eq('id', id).eq('business_id', businessId).single();

  if (existErr) {
    if (existErr.code === 'PGRST116') throw new NotFoundError('Combo nao encontrado.');
    throw existErr;
  }

  const ext = mimeType.split('/')[1] || 'jpg';
  const filePath = `${businessId}/combo-${id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('service-images')
    .upload(filePath, fileBuffer, { contentType: mimeType, upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('service-images')
    .getPublicUrl(filePath);

  const imageUrl = urlData.publicUrl;

  const { data, error } = await supabase
    .from('combos')
    .update({ image_url: imageUrl })
    .eq('id', id)
    .eq('business_id', businessId)
    .select(COMBO_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCombo(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('combos')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Combo nao encontrado.');
    throw error;
  }
}
