// Shared constants used across App.tsx, useThreeScene.ts and helper modules

export const PANEL_T = 0.018;       // panel thickness in metres (~18 mm)
export const SNAP_DIST = 0.05;      // side-by-side wall snap tolerance (5 cm)
export const FRONT_INSET = 0.002;   // 2 mm gap on each side between front panel and cabinet edge
export const HDF_T = 0.003;         // HDF back panel thickness 3 mm
export const HDF_INSET = 0.002;     // 2 mm inset on each side of the HDF panel
export const STACK_OVERLAP = 0.10;  // minimum overlap in each axis to trigger stacking (10 cm)
export const ATTACH_DIST = SNAP_DIST; // auto-attach distance
export const DETACH_DIST = 0.08;    // 80 mm drag displacement to detach
export const DIVIDER_DETACH_DIST = 1.00; // 1000 mm Z drag needed to detach divider from cabinet
export const HYSTERESIS_DIST = 0.15; // 150 mm before re-snap to same cabinet
export const DIVIDER_EDGE_SNAP = 0.04; // 40 mm snap-to-edge distance for dividers
export const DRAWER_RAIL_CLEARANCE = 0.0125; // 12.5 mm clearance per side for drawer slides
export const DRAWER_BOX_REAR_OFFSET = 0.024; // 24 mm rear offset for drawer box bottom panel
export const DEFAULT_COUNTERTOP_THICKNESS_MM = 38; // default blat thickness when veneer is unknown
export const DEFAULT_HDF_FINISH_LABEL = 'Biały Korpusowy 0110';
export const BOX_OVERLAY_Y_OFFSET = 0.016; // 16 mm drop of overlay front face relative to box center

export const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
