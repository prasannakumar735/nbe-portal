import type { PVCFormValues } from '@/app/(portal)/pvc-calculator/components/PVCForm'

export function createInitialPVCFormValues(): PVCFormValues {
  return {
    customer: '',
    attn: '',
    address: '',
    refNo: '',
    width: 3000,
    height: 2500,
    stripType: 'standard',
    stripWidth: 200,
    hangerWidth: 200,
    stripsPerHanger: 1,
    thickness: 2,
    overlap: 50,
    headrailType: 'galvanized',
    doorType: 'whole_door',
    installType: 'supply_install',
    manualInstallationPrice: 0,
    manualFreightPrice: 0,
    freightRequired: false,
    doorQuantity: 1,
  }
}
