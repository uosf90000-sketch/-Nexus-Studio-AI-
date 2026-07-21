import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ProjectsService } from '@/modules/projects/service'
import { prisma } from '@/lib/prisma'

describe('ProjectsService', () => {
  let service: ProjectsService

  beforeAll(() => {
    service = new ProjectsService()
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.project.deleteMany({})
  })

  it('should create a project with title and idea', async () => {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) {
      console.log('Skipping test: API keys not configured')
      return
    }

    const result = await service.createProject({
      title: 'Test Project',
      idea: 'A simple test idea',
    })

    expect(result.project).toHaveProperty('id')
    expect(result.project.title).toBe('Test Project')
    expect(result.project.idea).toBe('A simple test idea')
    expect(result.project.documents.length).toBeGreaterThan(0)

    if (result.cost) {
      expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(0)
    }
  })

  it('should get a project by ID', async () => {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) {
      console.log('Skipping test: API keys not configured')
      return
    }

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
    if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) {
      console.log('Skipping test: API keys not configured')
      return
    }

    await service.createProject({
      title: 'List Test 1',
      idea: 'First test',
    })

    await service.createProject({
      title: 'List Test 2',
      idea: 'Second test',
    })

    const projects = await service.listProjects()

    expect(projects.length).toBeGreaterThanOrEqual(2)
    expect(projects[0]).toHaveProperty('id')
    expect(projects[0]).toHaveProperty('title')
  })

  it('should return null for non-existent project', async () => {
    const project = await service.getProject('non-existent-id')
    expect(project).toBeNull()
  })
})
