import { KnowledgeEditorClient } from '@/components/knowledge/KnowledgeEditorClient'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function KnowledgeEditPage({ params }: PageProps) {
  const { id } = await params
  return <KnowledgeEditorClient mode="edit" id={id} />
}
