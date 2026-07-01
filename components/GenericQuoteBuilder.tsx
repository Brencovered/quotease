    const intakeData = { ...intake, tradeKey };
    const extraTotals = extraLinesTotals(extraLines, profile.hourly_rate ?? 85, effectiveMargin);
    const quotePayload: Record<string, unknown> = {
      profile_id:    businessId,
      client_id:     resolvedClientId,
      client_name:   clientName,
      client_email:  clientEmail,
      site_address:  siteAddress,
      trade:         tradeKey,
      job_type:      jobType,
      intake_data:   intakeData,
      labour_hours:  result.labourHours,
      materials_cost: result.materialsCost + extraTotals.materials,
      total_cost:    result.totalCost,
      payment_terms: paymentTerms,
      markup_materials: preMarkupMaterials ?? [],
      status:        sendEmail ? "sent" : "draft",
      sent_at:       sendEmail ? new Date().toISOString() : null,
    };
    if (selectedPricingTierId) quotePayload.pricing_tier_id = selectedPricingTierId;
    if (selectedJobSizeTierId) quotePayload.job_size_tier_id = selectedJobSizeTierId;
    const { data: quote, error } = await supabase.from("quotes").insert(quotePayload).select().single();
