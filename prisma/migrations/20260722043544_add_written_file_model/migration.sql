-- CreateTable
CREATE TABLE "WrittenFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskRunId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WrittenFile_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WrittenFile_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WrittenFile_taskRunId_idx" ON "WrittenFile"("taskRunId");

-- CreateIndex
CREATE INDEX "WrittenFile_reviewId_idx" ON "WrittenFile"("reviewId");
