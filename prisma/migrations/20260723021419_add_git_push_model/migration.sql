-- CreateTable
CREATE TABLE "GitPush" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskRunId" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GitPush_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GitPush_taskRunId_idx" ON "GitPush"("taskRunId");

-- CreateIndex
CREATE UNIQUE INDEX "GitPush_taskRunId_key" ON "GitPush"("taskRunId");
