/** Numbered door diagram labels (PDF + maintenance UI). One string per item — wrap per cell, not as one blob. */
export const DOOR_DIAGRAM_LEGEND_ITEMS = [
  '01. Movement',
  '02. Fabric',
  '03. Stiffener',
  '04. View Window',
  '05. Straps & Buckles',
  '06. Upright',
  '07. Drum Cover',
  '08. Fixtures',
  '09. Cables',
  '10. Open & Close Height',
  '11. Hazard Light / Traffic Light',
  '12. Manual Mode',
  '13. Automatic Mode',
  '14. Interlock',
  '15. Push Button',
  '16. Sensors / Radar / Remote Control / Induction Loop',
  '17. Photocell Cells',
  '18. Safety Edge',
  '19. Emergency Switch',
  '20. Control Box',
  '21. Conduit',
  '22. Gearbox',
  '23. Drive Shaft',
  '24. Bearing',
  '25. Limit Switch / Encoder',
  '26. Chain / Belt',
] as const

/** Legacy single-line form (avoid for layout; prefer DOOR_DIAGRAM_LEGEND_ITEMS). */
export const DOOR_DIAGRAM_LEGEND = DOOR_DIAGRAM_LEGEND_ITEMS.join(' | ')
