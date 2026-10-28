import type { ResearchSummary } from './research';

export function selectResearchProject(projects: ResearchSummary[], preferred: number | null): number | null {
  if (projects.some(project => project.id === preferred)) return preferred;
  return projects.find(project => project.status === 'active')?.id ?? projects[0]?.id ?? null;
}
