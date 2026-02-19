# Premium Design System - Visual Style Guide

## Color Palette

### Primary Colors
```
Deep Purple (Primary Brand)
  Light:  #7c3aed  (purple-600)
  Dark:   #5b21b6  (purple-700)
  Accent: #6d28d9  (purple-700 gradient)
  Glow:   #7c3aed/30 (purple-500/30)
  
Deep Slate (Text & Backgrounds)
  Primary Text:    #1e293b  (slate-900)
  Secondary Text:  #475569  (slate-600)
  Tertiary Text:   #78716c  (slate-400)
  Light BG:        #f1f5f9  (slate-100)
  Lighter BG:      #f8fafc  (slate-50)
```

### Supporting Colors
```
Success (Green)
  Background: #ecfdf5  (emerald-50)
  Border:     #d1fae5  (emerald-100)
  Text:       #065f46  (emerald-700)
  Icon:       #10b981  (emerald-600)

Danger (Red)
  Background: #fef2f2  (red-50)
  Border:     #fee2e2  (red-100)
  Text:       #7f1d1d  (red-800)
  Button:     #ef4444  (red-500)

Warning (Amber)
  Background: #fffbeb  (amber-50)
  Border:     #fef3c7  (amber-100)
  Text:       #92400e  (amber-800)
  Icon:       #f59e0b  (amber-500)

Neutral (Gray)
  White:      #ffffff
  Border:     #e5e7eb  (gray-200)
  Divider:    #f3f4f6  (gray-100)
  BG:         #fafafa  (gray-50)
```

---

## Typography System

### Font Stack
```
Primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
Monospace: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace
```

### Scale & Weights

#### Display
- **4xl (36px)** - font-black (900) - Page titles, hero headers
- **3xl (30px)** - font-black (900) - Section titles, large stats
- **2xl (24px)** - font-bold (700) - Component headers
- **xl (20px)** - font-bold (700) - Card titles

#### Body Text
- **lg (18px)** - font-semibold (600) - Emphasis on body text
- **base (16px)** - font-medium (500) - Standard body, buttons
- **sm (14px)** - font-medium (500) - Secondary info
- **xs (12px)** - font-semibold (600) - Labels, timestamps

#### Special Cases
- **Monospace (timer)** - `font-mono` 18-36px - Time display
- **Uppercase labels** - `uppercase tracking-widest` - Field labels
- **Tracking widest** - 0.125em letter-spacing - Premium labels

---

## Spacing System

### Base Unit: 4px (Tailwind)

```
xs:  1 unit  = 4px
sm:  2 units = 8px
md:  3 units = 12px
lg:  4 units = 16px
xl:  6 units = 24px
2xl: 8 units = 32px
3xl: 12 units = 48px
4xl: 16 units = 64px
```

### Component Spacing

**Cards & Containers:**
- Padding: `p-6` (24px) to `p-8` (32px)
- Gap between items: `gap-6` to `gap-8`
- Section spacing: `space-y-8` (32px between sections)
- Max width: `max-w-[1200px]` for content area

**Form Elements:**
- Input padding: `px-4 py-3` (16px × 12px)
- Button padding: `px-6 py-3` (24px × 12px)
- Gap between inputs: `gap-4` (16px)

**Lists & Grids:**
- Item gap: `gap-4` to `gap-6`
- Grid columns: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Divider spacing: `divide-y divide-gray-100`

---

## Border & Shadow System

### Borders
```
Thin:   border (1px)
Color:  border-gray-200 (primary), border-gray-100 (light), border-purple-200 (accent)
Radius:
  - Small:     rounded-lg (8px)
  - Medium:    rounded-xl (12px)
  - Large:     rounded-2xl (16px)
  - XLarge:    rounded-3xl (24px)
  - Full:      rounded-full
```

### Shadows
```
None:   shadow-none
Light:  shadow-sm (0 1px 2px rgba(0,0,0,0.05))
Medium: shadow-md (0 4px 6px rgba(0,0,0,0.1))
Large:  shadow-lg (0 10px 15px rgba(0,0,0,0.1))
Colored Shadows:
  - shadow-purple-500/30  (with purple glow)
  - shadow-emerald-500/30 (with green glow)
  - shadow-red-500/30     (with red glow)
```

---

## Interactive States

### Button States

**Default:**
```
bg-white border border-gray-300 text-slate-700
hover:bg-gray-50
focus:ring-2 ring-purple-500/30 ring-offset-2
active:scale-95
disabled:opacity-50 disabled:cursor-not-allowed
```

**Primary (Purple Gradient):**
```
bg-gradient-to-r from-purple-600 to-purple-700
hover:from-purple-700 hover:to-purple-800
text-white font-semibold
rounded-xl px-6 py-3
transition-all duration-200
hover:shadow-lg hover:shadow-purple-500/30
active:scale-95
transform hover:scale-105
```

**Danger (Red):**
```
bg-red-500 hover:bg-red-600
disabled:bg-red-400
text-white font-semibold
rounded-xl px-4 py-3
```

### Input States

**Default:**
```
px-4 py-3 border border-gray-300 bg-white
text-sm font-medium
rounded-xl
focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500
outline-none transition-all
```

**Error:**
```
border-red-300 bg-red-50
text-red-700
```

**Disabled:**
```
bg-gray-100 cursor-not-allowed
opacity-60
```

### Badge States

**Completed (Green):**
```
bg-gradient-to-r from-emerald-50 to-transparent
border border-emerald-100
text-emerald-700
rounded-lg px-3 py-1.5
```

**Active (Purple):**
```
bg-gradient-to-r from-purple-50 to-transparent
border border-purple-100
text-purple-700
rounded-lg px-3 py-1.5
```

**Pending (Amber):**
```
bg-gradient-to-r from-amber-50 to-transparent
border border-amber-100
text-amber-700
rounded-lg px-3 py-1.5
```

---

## Animation & Motion

### Transitions
```
Smooth Transition (most common):
  transition-all duration-200 ease-in-out

Specific Transitions:
  transition-colors duration-200       (color changes)
  transition-transform duration-200    (scale, translate)
  transition-opacity duration-200      (fade)
  transition-shadow duration-200       (shadow changes)
```

### Transforms

**Hover Effects:**
```
scale-105       - 5% enlarge (comfortable, not aggressive)
scale-[1.02]    - 2% enlarge (subtle)
-translate-y-1  - slight lift
translate-x-1   - slight shift
```

**Active/Click:**
```
scale-95        - compress slightly on click
active:scale-95 - with active pseudo-class
```

### Animations

**Loading:**
```
animate-spin      - 1s rotation loop
animate-pulse     - opacity pulse, 2s loop
```

**Special:**
```
group-hover:opacity-100      - show on hover
group-hover:translate-y-1    - move on hover
```

---

## Layout Grid System

### Responsive Breakpoints
```
Mobile:  < 640px  (sm)
Tablet:  640px    (md: 768px)
Desktop: 1024px   (lg)
Wide:    1280px   (xl)
```

### Column Configurations

**1 Column (Full Width):**
```
grid-cols-1 (default mobile)
w-full
```

**2 Columns (Tablet):**
```
md:grid-cols-2
gap-4 to gap-6
```

**3 Columns (Desktop):**
```
lg:grid-cols-3
gap-4 to gap-6
```

**4 Columns (Large Desktop):**
```
lg:grid-cols-4
gap-4 to gap-6
```

### Common Patterns

**Hero Section:**
```
bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900
rounded-3xl p-8 md:p-12
text-white overflow-hidden relative
```

**Card Container:**
```
bg-white border border-gray-200
rounded-2xl shadow-sm
p-6 md:p-8
hover:shadow-md transition-all
```

**Content Area:**
```
max-w-[1200px] mx-auto w-full
p-8 space-y-8
```

---

## Gradient Usage

### Backgrounds
```
Horizontal Gradient:
  bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900
  
Vertical Gradient:
  bg-gradient-to-b from-purple-50 to-white
  
Text Gradient:
  text-transparent bg-clip-text
  bg-gradient-to-r from-purple-600 to-purple-700
```

### Hover Gradients
```
Default to Hover:
  from-purple-600 to-purple-700
  hover:from-purple-700 hover:to-purple-800
```

---

## Dark Mode (Future)

### Dark Mode Classes
```
dark:bg-slate-900
dark:border-slate-700
dark:text-white
dark:hover:bg-slate-800
```

### Example Implementation
```tsx
className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700"
```

---

## Accessibility

### Contrast Ratios
- Text on purple background: Use white or light gray
- Text on white background: Use slate-900
- Icons: Minimum 4.5:1 contrast ratio

### Focus States
```
Always include focus:ring-2
Use ring-offset-2 for better visibility
Focus color: ring-purple-500/30
```

### Font Sizes
- Minimum: 12px (xs) for secondary text
- Primary: 16px (base) or larger
- Clickable elements: minimum 48px height/width

### Keyboard Navigation
- Use semantic HTML (button, form, etc.)
- Tab order makes sense
- Focus indicators visible
- No keyboard traps

---

## Common Component Patterns

### Premium Card
```tsx
<div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 hover:shadow-md transition-all">
  {content}
</div>
```

### Primary Button
```tsx
<button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95 transform hover:scale-105">
  {label}
</button>
```

### Section Header
```tsx
<div>
  <h2 className="text-3xl font-black text-slate-900 mb-1">
    Title
  </h2>
  <p className="text-sm text-slate-600">
    Subtitle
  </p>
</div>
```

### Status Badge
```tsx
<div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
  <CheckCircle size={16} className="text-emerald-600" />
  <span className="text-xs font-bold text-emerald-700 uppercase tracking-tight">
    Completed
  </span>
</div>
```

---

## Do's and Don'ts

### ✅ Do's
- Use consistent spacing (multiples of 4px)
- Apply smooth transitions (200ms)
- Provide visual feedback on interactions
- Use purple as primary accent color
- Keep borders subtle and minimal
- Use gradients sparingly but effectively
- Test on mobile, tablet, and desktop
- Maintain clear visual hierarchy
- Use premium shadow effects
- Implement proper focus states

### ❌ Don'ts
- Don't use harsh colors or high saturation
- Don't add too many borders
- Don't use animations > 300ms without reason
- Don't make interactive elements too small
- Don't use default browser styles
- Don't mix too many font sizes
- Don't create visual clutter
- Don't forget accessibility
- Don't use placeholder text as labels
- Don't ignore responsive design

---

Generated: February 19, 2026
Last Updated: Complete Premium Redesign
