# Work Type Quick Reference

## Complete Work Type Hierarchy

### 📦 FAB - Fabrication (All Billable ✅)

| Code | Description | Billable |
|------|-------------|----------|
| FRM | Frame | ✅ |
| CUR | Curtain | ✅ |
| PVC | PVC Strip | ✅ |
| ELC | Electrical / Control Box | ✅ |
| RPR | Repair Preparation | ✅ |
| DRF | Drafting & Modelling | ✅ |

**Use for**: Physical fabrication work, door frame construction, curtain installation, electrical panel work, repair prep, and CAD drafting.

---

### 🏗️ OPS - Site Operations (Mixed Billable)

| Code | Description | Billable |
|------|-------------|----------|
| INS | Installation | ✅ |
| SRV | Service / Maintenance | ✅ |
| SRW | Warranty Service | ❌ |
| REP | Repair | ✅ |
| DEL | Delivery | ✅ |
| IND | Site Induction | ✅ |
| TRV | Travelling | ✅ |

**Use for**: On-site work including installation, repairs, maintenance, warranty work, deliveries, site inductions, and travel time.

**Note**: Warranty Service (SRW) is non-billable per company policy.

---

### 💼 BDV - Business Development (All Non-Billable ❌)

| Code | Description | Billable |
|------|-------------|----------|
| QTE | Quoting / Estimating | ❌ |
| CLM | Client Meeting | ❌ |
| RFP | Proposal / Tender | ❌ |
| TRV | Travelling | ❌ |

**Use for**: Sales activities, quote preparation, client meetings, proposal writing, and associated travel.

---

### 🏢 ADM - Administration (All Non-Billable ❌)

| Code | Description | Billable |
|------|-------------|----------|
| GEN | Emails, filing, internal coordination | ❌ |
| ACC | Finance, process, payroll support | ❌ |
| HR | Hiring, onboarding, reviews | ❌ |
| INT | Internal Meetings, Coordination | ❌ |
| CMP | Compliance / QA | ❌ |
| PRC | Procurement | ❌ |
| ITS | IT / Systems | ❌ |
| TRN | Training | ❌ |

**Use for**: All internal administrative work including emails, accounting, HR, meetings, compliance, procurement, IT support, and training.

---

### 🔬 RND - Research & Development (All Non-Billable ❌)

| Code | Description | Billable |
|------|-------------|----------|
| DIG | Digital (Web / App Development) | ❌ |
| PDT | Product Development | ❌ |
| INN | Innovation & Concepts | ❌ |

**Use for**: Internal R&D projects, digital tool development, new product design, and innovation initiatives.

---

### 🏖️ LVH - Leave & Holidays (All Non-Billable ❌, Leave Types 🏖️)

| Code | Description | Billable | Leave Type |
|------|-------------|----------|------------|
| PHL | Public Holiday | ❌ | ✅ |
| ALV | Annual Leave | ❌ | ✅ |
| SLV | Sick Leave | ❌ | ✅ |
| PLV | Personal Leave | ❌ | ✅ |

**Use for**: All types of leave including public holidays, annual leave, sick leave, and personal/carer's leave.

**Note**: Leave types do NOT require a project assignment.

---

## Usage Guidelines

### When Creating Time Entries

1. **Select Level1 first** - This determines the category (FAB, OPS, BDV, etc.)
2. **Select Level2** - This gives the specific task within that category
3. **Billable flag auto-sets** - Based on the Level2 selection
4. **Project required** - For all non-leave types
5. **Hours in 0.25 increments** - Quarter-hour intervals (e.g., 1.25, 2.5, 8.75)

### Common Scenarios

**Scenario 1: Installing a door on-site**
- Level1: `OPS` (Site Operations)
- Level2: `INS` (Installation)
- Billable: ✅ Yes
- Project: Required

**Scenario 2: Preparing a quote for new client**
- Level1: `BDV` (Business Development)
- Level2: `QTE` (Quoting / Estimating)
- Billable: ❌ No
- Project: Required

**Scenario 3: Taking annual leave**
- Level1: `LVH` (Leave & Holidays)
- Level2: `ALV` (Annual Leave)
- Billable: ❌ No
- Project: Not required

**Scenario 4: Warranty work for existing client**
- Level1: `OPS` (Site Operations)
- Level2: `SRW` (Warranty Service)
- Billable: ❌ No (special case)
- Project: Required

**Scenario 5: Internal training session**
- Level1: `ADM` (Administration)
- Level2: `TRN` (Training)
- Billable: ❌ No
- Project: Required (internal project)

---

## Billable vs Non-Billable Summary

### Billable Work Types (17 total)

**FAB** (6): All fabrication work
- FRM, CUR, PVC, ELC, RPR, DRF

**OPS** (6 of 7): Most site operations
- INS, SRV, REP, DEL, IND, TRV
- ❌ Excludes: SRW (Warranty)

### Non-Billable Work Types (22 total)

**OPS** (1): Warranty work
- SRW

**BDV** (4): All business development
- QTE, CLM, RFP, TRV

**ADM** (8): All administration
- GEN, ACC, HR, INT, CMP, PRC, ITS, TRN

**RND** (3): All R&D
- DIG, PDT, INN

**LVH** (4): All leave types
- PHL, ALV, SLV, PLV (also marked as leave types)

---

## Tips for Staff

✅ **DO:**
- Use specific work types that match your actual work
- Record time in 0.25 hour increments
- Add notes to clarify complex entries
- Submit your timesheet by end of week

❌ **DON'T:**
- Mix multiple work types in one entry (create separate entries)
- Exceed 16 hours in a single day
- Forget to assign a project (except for leave)
- Edit entries after submission (manager must unlock)

---

## Tips for Managers

✅ **When Reviewing:**
- Check project assignments are correct
- Verify billable/non-billable classifications
- Review overtime hours (>8 per day)
- Look for unusual patterns

✅ **When Rejecting:**
- Always provide clear reasons
- Suggest corrections needed
- Be specific about which entries

✅ **When Unlocking:**
- Document the reason
- Notify the employee
- Set a re-submission deadline

---

## Audit & Compliance

All work type assignments are:
- ✅ Logged in audit trail
- ✅ Tracked by user and timestamp
- ✅ Reviewable by managers and admins
- ✅ Exportable for payroll and billing

Changes to billable flags require:
- Database administrator access
- Approval from finance department
- Update in work_types table

---

## Questions?

**"Which work type for travel to a client site?"**
- If it's for a sales meeting: BDV → TRV (non-billable)
- If it's for installation/service: OPS → TRV (billable)

**"Which work type for preparing project documentation?"**
- If it's CAD drawings: FAB → DRF (billable)
- If it's compliance docs: ADM → CMP (non-billable)

**"Can I change a billable entry to non-billable?"**
- No - billable flag is auto-set by work type
- Contact manager if work type selection was wrong

**"What if I work on multiple projects in one day?"**
- Create separate time entries for each project
- Each entry can have different work types

**"How do I record half days?"**
- Use appropriate hours (e.g., 4.0 for half day)
- For leave: LVH → ALV with 4.0 hours

---

**Last Updated**: February 19, 2026  
**Total Work Types**: 39  
**Billable Types**: 17  
**Non-Billable Types**: 22
