export const generateQuotePDF = async () => {
  const html2pdf = (await import('html2pdf.js')).default as any

  const element = document.getElementById('quote-pdf')

  if (!element) {
    console.error('Quote PDF element not found')
    return
  }

  const opt = {
    margin: 5,
    filename: `service-quote-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 1.5,
      useCORS: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
  }

  await new Promise<void>(resolve => {
    window.requestAnimationFrame(() => resolve())
  })

  await html2pdf().set(opt).from(element).save()
}
