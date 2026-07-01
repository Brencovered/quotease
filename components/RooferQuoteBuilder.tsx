    const quotePayload: Record<string, unknown> = {
      quoteNumber: generateQuoteNumber(),
      clientId: preClientId || null,
      clientName: "",
      clientAddress: "",
      date: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      jobs: jobs.map((j, i) => ({
        index: i + 1,
        area: j.area,
        pitch: j.pitchType,
        style: j.roofStyle,
        description: j.description,
        photos: j.photos.length,
        annotations: j.annotations,
      })),
      material: MATERIALS[material],
      color,
      labourRate: RATES[labourRate],
      tier,
      extras,
      notes,
      warranty,
      summary: {
        totalArea: summary.totalArea,
        labour: summary.labour,
        materials: summary.matCost,
        extras: summary.extrasTotal,
        colorSurcharge: summary.colorSurcharge,
        subtotal: summary.subtotal,
        gst: summary.gst,
        total: summary.total,
      },
    };
    if (selectedPricingTierId) quotePayload.pricing_tier_id = selectedPricingTierId;
    if (selectedJobSizeTierId) quotePayload.job_size_tier_id = selectedJobSizeTierId;

    return quotePayload;
