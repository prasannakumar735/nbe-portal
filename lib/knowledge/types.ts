export type KnowledgeMediaType = 'image' | 'video' | 'pdf' | 'other'

export type KnowledgeArticleRow = {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  created_by: string
  created_at: string
  updated_at: string
}

export type KnowledgeMediaRow = {
  id: string
  article_id: string
  media_url: string
  type: KnowledgeMediaType
  created_at: string
}
