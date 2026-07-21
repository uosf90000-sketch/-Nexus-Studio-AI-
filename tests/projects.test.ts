import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { ProjectsService } from '@/modules/projects/service'
import { prisma } from '@/lib/prisma'
import { mockClaudeResponse, mockFetchSuccess } from './setup'

describe('ProjectsService', () => {
  let service: ProjectsService

  beforeAll(() => {
    service = new ProjectsService()
    // Mock fetch for Claude API
    mockFetchSuccess()
  })

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.project.deleteMany({})
  })

  it('should create a project with title and idea', async () => {
    const result = await service.createProject({
      title: 'Test Project',
      idea: 'A simple test idea',
    })

    expect(result.project).toHaveProperty('id')
    expect(result.project.title).toBe('Test Project')
    expect(result.project.idea).toBe('A simple test idea')
    expect(result.project.documents.length).toBeGreaterThan(0)

    // Verify document content
    const doc = result.project.documents[0]
    expect(doc.type).toBe('summary_and_prd')
    expect(doc.content).toBeTruthy()

    if (result.cost) {
      expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(0)
    }
  })

  it('should get a project by ID', async () => {
    const createResult = await service.createProject({
      title: 'Get Test Project',
      idea: 'Test getting a project',
    })

    const project = await service.getProject(createResult.project.id)

    expect(project).toBeTruthy()
    expect(project?.title).toBe('Get Test Project')
    expect(project?.documents.length).toBeGreaterThan(0)
  })

  it('should list all projects', async () => {
    // Create test projects
    const proj1 = await service.createProject({
      title: 'List Test 1',
      idea: 'First test',
    })

    const proj2 = await service.createProject({
      title: 'List Test 2',
      idea: 'Second test',
    })

    const projects = await service.listProjects()

    expect(projects.length).toBeGreaterThanOrEqual(2)
    expect(projects[0]).toHaveProperty('id')
    expect(projects[0]).toHaveProperty('title')

    // Verify our created projects are in the list
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

    const costs = await prisma.costEntry.findMany({
      where: { projectId: result.project.id },
    })

    expect(costs.length).toBeGreaterThan(0)
    expect(costs[0].provider).toBe('claude')
    expect(costs[0].inputTokens).toBeGreaterThan(0)
    expect(costs[0].outputTokens).toBeGreaterThan(0)
  })

  it('should save project documents correctly', async () => {
    const result = await service.createProject({
      title: 'Document Test',
      idea: 'Test document storage',
    })

    const docs = await prisma.projectDocument.findMany({
      where: { projectId: result.project.id },
    })

    expect(docs.length).toBeGreaterThan(0)
    expect(docs[0].type).toBe('summary_and_prd')

    const content = JSON.parse(docs[0].content)
    expect(content).toHaveProperty('summary')
    expect(content).toHaveProperty('shortPrd')
  })
})
