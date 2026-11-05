export interface BirthdayEnvelope {
  letter_id: number;
  source: 'platform' | 'space';
  sender_name: string;
  title: string;
  occasion: string;
  opened_at: number | null;
  updated_at: number;
}
export interface BirthdayStatus {
  server_now: number;
  month: number | null;
  day: number | null;
  can_change: boolean;
  available_at: number | null;
  active: boolean;
  celebration_id: string | null;
  ends_at: number | null;
  auto_open: boolean;
  letters: BirthdayEnvelope[];
}
export interface BirthdayLetterDraft {
  birthday_month: number | null;
  birthday_day: number | null;
  birthday_year: number | null;
  occasion: string | null;
  letter: {title: string; body: string; opened_at: number | null} | null;
}
