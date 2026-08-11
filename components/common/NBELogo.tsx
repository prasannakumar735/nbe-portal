import Image from 'next/image'

export default function NBELogo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/NBE_LOGO_BK_PL.png"
        alt="NBE Australia"
        width={160}
        height={93}
        priority
        className="h-auto w-auto max-h-14 object-contain"
      />
    </div>
  )
}
