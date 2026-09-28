ALTER TABLE "notifications" ADD COLUMN "emailed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "comments_evaluation_idx" ON "comments" USING btree ("evaluation_id","resolved_at");--> statement-breakpoint
CREATE INDEX "approvals_version_idx" ON "approvals" USING btree ("report_version_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_unsent_idx" ON "notifications" USING btree ("emailed_at");