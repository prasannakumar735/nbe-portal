import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'

export type IndustrySeedOverlay = {
  audienceAdditions: string[]
  painPointAdditions: string[]
  operationalChallengeAdditions: string[]
  valueEmphasis: string
  subjectAngle: string
}

export const INDUSTRY_SEED_OVERLAY: Record<SalesIndustrySlug, IndustrySeedOverlay> = {
  general: {
    audienceAdditions: ['Site manager'],
    painPointAdditions: [
      'Pressure to keep operating costs predictable while equipment ages',
      'Safety incidents or near-misses at busy doorways',
    ],
    operationalChallengeAdditions: [
      'Limited time to evaluate door solutions between daily operational demands',
    ],
    valueEmphasis:
      'Emphasise practical site assessment, reliable industrial door solutions, and support from a local Australian supplier.',
    subjectAngle: 'operational efficiency or doorway reliability at industrial sites',
  },
  food_processing: {
    audienceAdditions: ['Quality manager', 'Hygiene or HACCP coordinator'],
    painPointAdditions: [
      'Hygiene zoning between raw, process, and storage areas',
      'Pest and dust ingress affecting food safety programs',
      'Audit findings linked to doorway control or damaged barriers',
    ],
    operationalChallengeAdditions: [
      'Wash-down and chemical exposure near openings',
      'Maintaining traffic flow without compromising hygiene barriers',
    ],
    valueEmphasis:
      'Emphasise hygiene-aware doorway solutions, suitable materials for food environments, and consultative site assessment—without claiming certification unless documented.',
    subjectAngle: 'hygiene zoning or doorway control in food processing',
  },
  cold_storage: {
    audienceAdditions: ['Cold store manager', 'Refrigeration or facilities lead'],
    painPointAdditions: [
      'Cold air loss at freezer or chiller doorways under heavy traffic',
      'Frost, ice, or condensation affecting strips, seals, or door mechanisms',
      'Compressor load concerns when openings are left compromised',
    ],
    operationalChallengeAdditions: [
      'High cycle counts on freezer and cool-room openings',
      'Balancing energy management with dispatch and picking speed',
    ],
    valueEmphasis:
      'Emphasise cold-chain-aware doorway solutions and site-specific recommendations; use qualified language on temperature retention—no percentage energy claims.',
    subjectAngle: 'cold-store doorways or chilled traffic openings',
  },
  warehousing: {
    audienceAdditions: ['Distribution centre manager', 'Dispatch supervisor'],
    painPointAdditions: [
      'Congestion at dock and internal doorways during peak picks and loads',
      'Strip or door damage from forklift traffic',
      'Security or weather exposure when dock doors fail',
    ],
    operationalChallengeAdditions: [
      'Seasonal volume spikes stressing door assets',
      'Coordinating multi-dock availability for carriers',
    ],
    valueEmphasis:
      'Emphasise traffic flow, dock efficiency, and durable solutions suited to warehouse and MHE patterns.',
    subjectAngle: 'warehouse traffic flow or loading dock reliability',
  },
  manufacturing: {
    audienceAdditions: ['Plant manager', 'Production supervisor'],
    painPointAdditions: [
      'Dust, noise, or temperature transfer between production zones',
      'Production delays when critical doors are out of service',
      'WHS exposure where pedestrians and forklifts meet at openings',
    ],
    operationalChallengeAdditions: [
      'Integrating door upgrades with production lines and shift patterns',
      'Contamination control between process and storage areas',
    ],
    valueEmphasis:
      'Emphasise production continuity, zone separation, and safety at industrial openings.',
    subjectAngle: 'production flow or separation at plant doorways',
  },
  logistics: {
    audienceAdditions: ['Transport manager', 'Fleet or depot manager'],
    painPointAdditions: [
      'Turnaround time affected by slow or faulty dock equipment',
      'Carrier complaints when dock conditions are inconsistent',
      'After-hours security at unmanned depots',
    ],
    operationalChallengeAdditions: [
      'Variable trailer configurations across the carrier base',
      'Tight dispatch windows across multiple bays',
    ],
    valueEmphasis:
      'Emphasise loading efficiency, reliable dock operation, and minimal disruption to dispatch schedules.',
    subjectAngle: 'dispatch efficiency or dock availability',
  },
  pharmaceutical: {
    audienceAdditions: ['Quality assurance manager', 'Validation or compliance lead'],
    painPointAdditions: [
      'Controlled environment integrity at material and goods passages',
      'Documentation expectations for equipment affecting GMP areas',
      'Contamination control between classified and non-classified spaces',
    ],
    operationalChallengeAdditions: [
      'Change control when modifying openings in validated areas',
      'Balancing access for materials handling with environmental control',
    ],
    valueEmphasis:
      'Emphasise consultative assessment, suitable industrial door solutions for controlled facilities, and respect for validation processes—do not claim GMP certification unless supplied.',
    subjectAngle: 'controlled environment doorways or compliant access',
  },
}
