export type Announcement = {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
