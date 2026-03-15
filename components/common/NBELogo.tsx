import Image from 'next/image'

export default function NBELogo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/nbe-logo.png"
        alt="NBE Australia"
        width={160}
        height={60}
        priority
      />
    </div>
  )
}