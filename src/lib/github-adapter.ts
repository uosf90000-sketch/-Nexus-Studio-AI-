// NEXUS-P2C3-001: GitHub Adapter (Mock-safe)
// Interfaces with GitHub API to create branches and commits
// All operations are mockable; no real token is used in tests

export interface GitHubAdapterConfig {
  token?: string
  repoOwner: string
  repoName: string
}

export interface CreateBranchRequest {
  baseBranch: string
  newBranch: string
}

export interface CreateCommitRequest {
  branch: string
  message: string
  content: string
  filePath: string
}

export interface GitHubAdapterResponse {
  success: boolean
  commitSha?: string
  error?: string
}

export class GitHubAdapter {
  private token?: string
  private repoOwner: string
  private repoName: string

  constructor(config: GitHubAdapterConfig) {
    this.token = config.token
    this.repoOwner = config.repoOwner
    this.repoName = config.repoName

    // Token must be fine-grained and scoped to output repos only
    // This is NOT the Nexus repo token
  }

  getRepoFullName(): string {
    return `${this.repoOwner}/${this.repoName}`
  }

  async createBranch(req: CreateBranchRequest): Promise<GitHubAdapterResponse> {
    if (!this.token) {
      return {
        success: false,
        error: 'GitHub token is missing. Set GITHUB_OUTPUT_TOKEN in .env.local',
      }
    }

    try {
      // Call GitHub API to create branch
      // In tests, this is mocked
      const response = await fetch(
        `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/refs`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            ref: `refs/heads/${req.newBranch}`,
            sha: req.baseBranch, // In real usage: fetch base branch SHA first
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `Failed to create branch: ${errorData.message || response.statusText}`,
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Branch creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async createCommit(req: CreateCommitRequest): Promise<GitHubAdapterResponse> {
    if (!this.token) {
      return {
        success: false,
        error: 'GitHub token is missing.',
      }
    }

    try {
      // Call GitHub API to create commit
      // This uses the GitHub REST API to update a file on a branch
      const response = await fetch(
        `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${req.filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `token ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: req.message,
            content: Buffer.from(req.content).toString('base64'),
            branch: req.branch,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `Failed to create commit: ${errorData.message || response.statusText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        commitSha: data.commit?.sha,
      }
    } catch (error) {
      return {
        success: false,
        error: `Commit creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }
}
