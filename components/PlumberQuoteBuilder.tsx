    const extraTotals = extraLinesTotals(extraLines, rate, effectiveMargin);
    const quotePayload: Record<string, unknown> = {
      profile_id: businessId,
      client_id: resolvedClientId,
      client_name: clientName,
      client_email: clientEmail,
      site_address: siteAddress,
      trade: "plumber",
      job_type: intake.jobType,
      intake_data: intake,
      labour_hours: result.labourHours + extraLines.reduce((s,l) => s + l.hours, 0),
      materials_cost: result.materialsCost + extraTotals.materials,
      total_cost: result.totalCost + extraTotals.total,
      payment_terms: paymentTerms,
      status: sendEmail ? "sent" : "draft",
      sent_at: sendEmail ? new Date().toISOString() : null,
      markup_materials: preMarkupMaterials ?? [],
    };
    if (selectedPricingTierId) quotePayload.pricing_tier_id = selectedPricingTierId;
    if (selectedJobSizeTierId) quotePayload.job_size_tier_id = selectedJobSizeTierId;
    const { data: quote, error } = await supabase.from("quotes").insert(quotePayload).select().single();
