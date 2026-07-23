-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskRunId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "gitPushId" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PullRequest_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PullRequest_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PullRequest_gitPushId_fkey" FOREIGN KEY ("gitPushId") REFERENCES "GitPush" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_taskRunId_key" ON "PullRequest"("taskRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_gitPushId_key" ON "PullRequest"("gitPushId");

-- CreateIndex
CREATE INDEX "PullRequest_reviewId_idx" ON "PullRequest"("reviewId");
