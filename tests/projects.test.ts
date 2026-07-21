import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { ProjectsService } from '@/modules/projects/service'
import { prisma } from '@/lib/prisma'
import { mockClaudeResponse, mockFetchSuccess } from './setup'

describe('ProjectsService', () => {
  let service: ProjectsService
  const createdProjectIds: string[] = []

  beforeAll(() => {
    service = new ProjectsService()
    mockFetchSuccess()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  afterAll(async () => {
    for (const projectId of createdProjectIds) {
      try {
        await prisma.task.deleteMany({ where: { projectId } })
        await prisma.projectDocument.deleteMany({ where: { projectId } })
        await prisma.costEntry.deleteMany({ where: { projectId } })
        await prisma.executionLog.deleteMany({ where: { projectId } })
        await prisma.project.deleteMany({ where: { id: projectId } })
      } catch {
        // ignore
      }
    }
  })

  it('should create a project with title and idea', async () => {
    const result = await service.createProject({
      title: 'Test Project',
      idea: 'A simple test idea',
    })

    createdProjectIds.push(result.project.id)
    expect(result.project).toHaveProperty('id')
    expect(result.project.title).toBe('Test Project')
    expect(result.project.documents.length).toBeGreaterThan(0)
    const doc = result.project.documents[0]
    expect(doc.type).toBe('summary_and_prd')
    if (result.cost) {
      expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(0)
    }
  })

  it('should get a project by ID', async () => {
    const createResult = await service.createProject({
      title: 'Get Test Project',
      idea: 'Test getting a project',
    })

    createdProjectIds.push(createResult.project.id)
    const project = await service.getProject(createResult.project.id)
    expect(project).toBeTruthy()
    expect(project?.title).toBe('Get Test Project')
    expect(project?.documents.length).toBeGreaterThan(0)
  })

  it('should list all projects', async () => {
    const proj1 = await service.createProject({
      title: 'List Test 1',
      idea: 'First test',
    })

    const proj2 = await service.createProject({
      title: 'List Test 2',
      idea: 'Second test',
    })

    createdProjectIds.push(proj1.project.id)
    createdProjectIds.push(proj2.project.id)

    const projects = await service.listProjects()
    expect(projects.length).toBeGreaterThanOrEqual(2)
    const titles = projects.map(p => p.title)
    expect(titles).toContain('List Test 1')
    expect(titles).toContain('List Test 2')
  })

  it('should return null for non-existent project', async () => {
    const project = await service.getProject('non-existent-id')
    expect(project).toBeNull()
  })

  it('should record cost entry for created project', async () => {
    const result = await service.createProject({
      title: 'Cost Test Project',
      idea: 'Test cost tracking',
    })

    createdProjectIds.push(result.project.id)
    const costs = await prisma.costEntry.findMany({
      where: { projectId: result.project.id },
    })

    expect(costs.length).toBeGreaterThan(0)
    expect(costs[0].provider).toBe('claude')
    expect(costs[0].inputTokens).toBeGreaterThan(0)
  })

  it('should save project documents correctly', async () => {
    const result = await service.createProject({
      title: 'Document Test',
      idea: 'Test document storage',
    })

    createdProjectIds.push(result.project.id)
    const docs = await prisma.projectDocument.findMany({
      where: { projectId: result.project.id },
    })

    expect(docs.length).toBeGreaterThan(0)
    expect(docs[0].type).toBe('summary_and_prd')
    const content = JSON.parse(docs[0].content)
    expect(content).toHaveProperty('summary')
  })
})
