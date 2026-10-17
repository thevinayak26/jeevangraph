import { notFound } from 'next/navigation';
import { isRole, isSection } from '@/lib/domain';
import { getPreviewWorkspace } from '@/lib/repository';
import { Workspace } from '@/components/workspace';

export default async function Page({
  params,
}: {
  params: Promise<{ role: string; section: string }>;
}) {
  const { role, section } = await params;
  if (!isRole(role) || !isSection(section)) notFound();
  if (role !== 'patient' && !['overview', 'settings'].includes(section)) notFound();
  return <Workspace data={getPreviewWorkspace(role)} section={section} />;
}
