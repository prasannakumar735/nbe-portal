import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'

export type ProductSeedContent = {
  overview: string
  targetAudience: string[]
  customerPainPoints: string[]
  operationalChallenges: string[]
  valueProposition: string
  typicalObjections: string[]
  subjectLineGuidance: string
  cta: string
  technicalAccuracyNotes: string[]
}

export const PRODUCT_SEED_CONTENT: Record<SalesProductLineSlug, ProductSeedContent> = {
  pvc_strip_curtains: {
    overview:
      'PVC strip curtains are flexible overlapping PVC strips fitted across doorways and openings. They allow forklifts, pallet jacks, and staff to pass through while helping to separate areas, limit draughts, and reduce transfer of dust, insects, and temperature between spaces. NBE Australia supplies and installs strip curtain systems suited to industrial and commercial sites.',
    targetAudience: [
      'Operations manager',
      'Warehouse manager',
      'Facilities manager',
      'Production supervisor',
      'Cold store manager',
    ],
    customerPainPoints: [
      'Temperature or conditioned air escaping through high-traffic doorways',
      'Dust, insects, or debris moving between production and storage areas',
      'Noise and distraction from open passages between zones',
      'Strip damage from forklift contact leading to gaps and replacement cycles',
      'Difficulty maintaining hygiene or zoning without blocking movement',
    ],
    operationalChallenges: [
      'Balancing open access for MHE with separation between chilled, ambient, and outdoor areas',
      'Keeping strips aligned and intact where traffic is constant',
      'Selecting strip material and overlap suited to the opening without over-specifying',
      'Coordinating installation around live operations and safety zones',
    ],
    valueProposition:
      'NBE Australia helps facilities improve doorway separation and traffic flow with PVC strip curtains sized and fitted for the opening and the way your site operates. We focus on practical installation, suitable strip configuration, and ongoing support—not generic catalogue quotes.',
    typicalObjections: [
      '"We already have strips—they just keep getting damaged." — Acknowledge traffic wear; discuss strip grade, overlap, and fixing details suited to the opening.',
      '"We cannot stop forklifts using that doorway." — Strip curtains are designed for frequent passage; clarify access vs full door closure.',
      '"Cold storage is too harsh for plastic." — Discuss cold-rated strip options and site assessment without quoting performance figures not verified on site.',
      '"It is only a small gap—we will fix it later." — Note how small openings still allow air and pest transfer; offer assessment without pressure.',
    ],
    subjectLineGuidance:
      'Max 8 words; Australian English; reference doorway traffic, temperature, or hygiene (e.g. "Strip curtains for busy cold-store doors"). No capitals for emphasis, no hype.',
    cta: "If it would be useful, we would be happy to arrange a no-obligation site assessment of your doorways, provide a product recommendation, or prepare a quotation based on your traffic and temperature requirements.",
    technicalAccuracyNotes: [
      'Do not state R-values, U-values, kW savings, or percentage energy reductions unless verified for that customer site.',
      'Describe benefits qualitatively (may help reduce draughts, can assist with zoning) rather than guaranteed outcomes.',
      'Do not specify strip thickness, width, or overlap dimensions unless taken from site survey or NBE quotation data supplied in context.',
    ],
  },
  rapid_roller_doors: {
    overview:
      'Rapid roller doors are motorised high-cycle doors designed for openings with frequent vehicle, forklift, or pedestrian traffic. They typically roll into a head box above the opening to minimise obstruction. NBE Australia supplies, installs, and services rapid roller doors for warehouses, factories, and distribution sites.',
    targetAudience: [
      'Operations manager',
      'Warehouse manager',
      'Facilities manager',
      'Health and safety representative',
      'Site engineering manager',
    ],
    customerPainPoints: [
      'Slow or unreliable doors creating queues at busy openings',
      'Unplanned downtime when doors fail during peak dispatch or production',
      'Safety concerns where traffic and pedestrians share doorways',
      'Heat or chilled air loss while doors remain open for long periods',
      'Reactive repair costs when maintenance has been deferred',
    ],
    operationalChallenges: [
      'Matching door speed and safety devices to traffic patterns and WHS expectations',
      'Maintaining reliable operation in dusty, wet, or temperature-controlled areas',
      'Planning replacement or upgrade without disrupting critical shifts',
      'Integrating doors with existing traffic management and loading processes',
    ],
    valueProposition:
      'NBE Australia supports sites that need dependable rapid roller doors aligned with traffic, safety, and environmental conditions. We provide site-focused recommendations, professional installation, and access to preventive maintenance—so doors support workflow rather than interrupt it.',
    typicalObjections: [
      '"Our current door is fine most of the time." — Explore peak-period delays and cost of failure during busy windows without inventing savings figures.',
      '"We cannot afford downtime for a replacement." — Discuss staged assessment and scheduling options; do not promise installation duration unless confirmed.',
      '"Safety sensors are too sensitive and stop production." — Acknowledge tuning and application review via site inspection.',
      '"We had a bad experience with another supplier." — Focus on NBE service scope and assessment; do not disparage competitors.',
    ],
    subjectLineGuidance:
      'Max 8 words; mention traffic flow, door reliability, or warehouse openings (e.g. "Rapid doors for high-traffic docks"). Professional tone; no urgency tricks.',
    cta: "If you'd like, we would be happy to arrange a no-obligation site assessment, provide a product recommendation, or prepare a quotation based on your opening sizes and traffic patterns.",
    technicalAccuracyNotes: [
      'Do not quote opening/closing speeds, cycle counts, or insulation values unless documented for that project.',
      'Avoid guaranteed uptime or payback claims.',
      'Refer to safety features in general terms (sensors, traffic interfaces) without naming unverified standards compliance unless supplied in context.',
    ],
  },
  preventive_maintenance: {
    overview:
      'Preventive maintenance for industrial doors covers planned inspections, adjustments, and servicing of rapid roller doors, dock doors, strip curtains, and related equipment before unplanned failures occur. NBE Australia offers maintenance programs tailored to site traffic and equipment types.',
    targetAudience: [
      'Facilities manager',
      'Maintenance manager',
      'Operations manager',
      'Warehouse manager',
      'Asset or property manager',
    ],
    customerPainPoints: [
      'Unexpected door failures during peak operating hours',
      'Emergency call-out costs and production or dispatch delays',
      'Limited in-house expertise on industrial door systems',
      'Difficulty tracking service history across multiple sites',
      'Compliance and WHS pressure when door safety devices are out of spec',
    ],
    operationalChallenges: [
      'Scheduling servicing without stopping critical loading or production windows',
      'Prioritising which openings matter most when budgets are constrained',
      'Aligning maintenance with OEM parts and correct adjustment procedures',
      'Documenting service for audits and internal asset management',
    ],
    valueProposition:
      'NBE Australia helps reduce reliance on reactive repairs through planned door maintenance aligned to how your facility runs. Programs focus on inspection, adjustment, and parts replacement before small faults become stoppages—using qualified technicians familiar with industrial door systems.',
    typicalObjections: [
      '"We only fix doors when they break." — Discuss operational risk during busy periods without promising specific cost avoidance percentages.',
      '"We have a general handyman on site." — Acknowledge internal capability; clarify specialist door safety and component expertise.',
      '"Maintenance contracts are hard to cancel or too rigid." — Offer conversation about scope and site assessment first.',
      '"We are not sure it is worth it for our volume." — Suggest assessment of critical openings; no ROI guarantees.',
    ],
    subjectLineGuidance:
      'Max 8 words; reference planned servicing, door reliability, or downtime risk (e.g. "Planned servicing for warehouse doors"). Calm, factual wording.',
    cta: "If it would help, we would be happy to arrange a no-obligation site assessment of your door assets, recommend a maintenance scope, or provide a quotation based on your equipment and traffic.",
    technicalAccuracyNotes: [
      'Do not promise elimination of all breakdowns or specific reduction in emergency spend.',
      'Describe maintenance outcomes with qualified language (may help identify wear early, can support safer operation).',
      'Do not invent service intervals; intervals are set after site review.',
    ],
  },
  dock_doors: {
    overview:
      'Dock doors and associated seals close the building envelope at loading docks where goods are transferred between trucks and the warehouse. They support weather protection, security, and workflow at the dock face. NBE Australia supplies and services dock door solutions for distribution, manufacturing, and cold chain facilities.',
    targetAudience: [
      'Warehouse manager',
      'Logistics manager',
      'Facilities manager',
      'Operations manager',
      'Cold store or distribution centre manager',
    ],
    customerPainPoints: [
      'Gaps at the dock allowing weather ingress, pests, or temperature loss',
      'Slow dock turnover when doors or seals fail to operate smoothly',
      'Safety risks at the dock edge during busy dispatch periods',
      'Damage to doors from impact with vehicles or misaligned trailers',
      'Inconsistent sealing when trailer heights vary',
    ],
    operationalChallenges: [
      'Keeping multiple docks available during peak freight windows',
      'Matching seals and shelters to typical trailer fleets without over-engineering',
      'Maintaining door reliability in corrosive or wash-down environments',
      'Coordinating repairs when a dock out of service affects scheduling',
    ],
    valueProposition:
      'NBE Australia helps distribution and manufacturing sites keep dock openings working safely and efficiently. We assess dock layout, traffic, and sealing needs, then recommend practical door and seal solutions with installation and maintenance support.',
    typicalObjections: [
      '"Drivers cope with a damaged seal." — Note comfort vs product integrity, temperature, and WHS; offer inspection.',
      '"We only use a few docks daily." — Focus on critical-path docks; avoid inventing utilisation statistics.',
      '"Cold chain loss is handled by the refrigeration plant." — Acknowledge plant role; discuss envelope losses at the dock without quantifying unless verified.',
      '"Capital budget is committed this year." — Offer assessment and quotation for planning; no pressure.',
    ],
    subjectLineGuidance:
      'Max 8 words; mention loading docks, sealing, or dispatch flow (e.g. "Dock door sealing for busy freight"). No marketing slogans.',
    cta: "If you'd like, we would be happy to arrange a no-obligation site assessment of your loading docks, provide a product recommendation, or prepare a quotation based on your freight and sealing requirements.",
    technicalAccuracyNotes: [
      'Do not quote temperature hold times, energy savings, or seal performance metrics without site-specific data.',
      'Refer to shelters, seals, and levellers generically unless product details are in context.',
      'Do not guarantee compliance outcomes; suggest assessment where hygiene or cold chain standards apply.',
    ],
  },
}
