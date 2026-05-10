'use client'

import { useEffect, useState } from 'react'
import { QuoteClassificationPick } from '@/components/quotes/QuoteClassificationPick'
import { RapidDoorQuoteForm } from '@/components/quotes/RapidDoorQuoteForm'
import { ServiceQuoteForm } from '@/components/quotes/ServiceQuoteForm'
import {
  defaultSubCategoryForType,
  subCategoryAllowed,
  type QuoteTypeSlug,
} from '@/lib/quotes/quoteTaxonomy'
import { isIndustrialRapidDoorTaxonomy } from '@/lib/quotes/quoteFlow'

export function QuoteCreateClient() {
  const [quoteType, setQuoteType] = useState<QuoteTypeSlug>('service')
  const [quoteSubCategory, setQuoteSubCategory] = useState(() => defaultSubCategoryForType('service'))

  useEffect(() => {
    if (!subCategoryAllowed(quoteType, quoteSubCategory)) {
      setQuoteSubCategory(defaultSubCategoryForType(quoteType))
    }
  }, [quoteType, quoteSubCategory])

  const rapidDoor = isIndustrialRapidDoorTaxonomy(quoteType, quoteSubCategory)

  const classificationPicker = (
    <QuoteClassificationPick
      quoteType={quoteType}
      quoteSubCategory={quoteSubCategory}
      onQuoteTypeChange={setQuoteType}
      onQuoteSubCategoryChange={setQuoteSubCategory}
    />
  )

  return rapidDoor ? (
    <RapidDoorQuoteForm key="quote-create-rapid-door" classificationSlot={classificationPicker} />
  ) : (
    <ServiceQuoteForm
      key={`quote-create-${quoteType}-${quoteSubCategory}`}
      classificationMode="external"
      externalClassification={{ quoteType, quoteSubCategory }}
      classificationSlot={classificationPicker}
    />
  )
}
