export type Category = 'male' | 'female'

export type Candidate = {
  id: string
  election_id?: string
  name: string
  class_name: string
  jersey_number: number
  category: Category
  photo_url: string | null
  active: boolean
}

export type ResultRow = Candidate & {
  votes: number
}

export type VoterRecord = {
  ballot_id: string
  user_id: string
  email: string
  submitted_at: string
  candidate_id: string
  candidate_name: string
  class_name: string
  jersey_number: number
  category: Category
}

export type Election = {
  id: string
  title: string
  status: 'draft' | 'open' | 'closed'
}
