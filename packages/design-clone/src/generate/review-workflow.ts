// Placeholder for review workflow (can be expanded later)
export async function saveDraft(theme: any): Promise<string> {
  const id = `draft-${Date.now()}`;
  console.log(`Draft saved: ${id}`);
  return id;
}

export async function listDrafts(): Promise<any[]> {
  return [];
}

export async function approveTheme(themeId: string): Promise<void> {
  console.log(`Theme approved: ${themeId}`);
}

export async function regenerateTheme(themeId: string): Promise<void> {
  console.log(`Regenerating theme: ${themeId}`);
}
