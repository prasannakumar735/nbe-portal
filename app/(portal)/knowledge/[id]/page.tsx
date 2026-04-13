import { KnowledgeArticleClient } from '@/components/knowledge/KnowledgeArticleClient'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function KnowledgeArticlePage({ params }: PageProps) {
  const { id } = await params
  return <KnowledgeArticleClient id={id} />
}
