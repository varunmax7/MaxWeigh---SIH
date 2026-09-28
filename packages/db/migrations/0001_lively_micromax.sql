CREATE TABLE "audit_head" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_id" bigint,
	"last_hash" char(64),
	CONSTRAINT "audit_head_singleton_check" CHECK ("audit_head"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"lab_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"ip" "inet",
	"user_agent" text,
	"prev_hash" char(64) NOT NULL,
	"hash" char(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text NOT NULL,
	"designation" text,
	"employee_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_check" CHECK ("user"."role" in ('ADMIN', 'INTAKE_OFFICER', 'TESTING_OFFICER', 'SENIOR_TESTING_OFFICER', 'CHIEF_METROLOGY_OFFICER', 'CONTROLLER', 'AUDITOR'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "env_readings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sensor_id" uuid NOT NULL,
	"lab_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"temp_c" numeric(5, 2) NOT NULL,
	"rh_pct" numeric(5, 2) NOT NULL,
	"pressure_hpa" numeric(6, 1) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "env_sensors" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lab_id" uuid NOT NULL,
	"hub_code" text NOT NULL,
	"device_key_hash" text NOT NULL,
	"calibrated_on" date,
	"due_on" date,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "env_sensors_status_check" CHECK ("env_sensors"."status" in ('active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "reference_weight_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lab_id" uuid NOT NULL,
	"set_code" text NOT NULL,
	"oiml_class" text NOT NULL,
	"items" jsonb NOT NULL,
	"cert_no" text,
	"calibrated_on" date,
	"due_on" date,
	"cert_attachment_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "reference_weight_sets_class_check" CHECK ("reference_weight_sets"."oiml_class" in ('E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3')),
	CONSTRAINT "reference_weight_sets_status_check" CHECK ("reference_weight_sets"."status" in ('active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"test_id" uuid,
	"kind" text NOT NULL,
	"caption" text,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text,
	"sha256" char(64) NOT NULL,
	"exif" jsonb,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_kind_check" CHECK ("attachments"."kind" in ('photo', 'document', 'calibration_cert', 'other'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"test_id" uuid,
	"row_ref" text,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"tier" smallint,
	"body" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_tests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"test_code" text NOT NULL,
	"range_index" integer DEFAULT 0 NOT NULL,
	"sequence" integer NOT NULL,
	"applicability" text NOT NULL,
	"na_reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"verdict" text,
	"params" jsonb,
	"observations" jsonb,
	"result" jsonb,
	"env_start" jsonb,
	"env_end" jsonb,
	"weight_set_ids" uuid[],
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "evaluation_tests_unique" UNIQUE("evaluation_id","test_code","range_index"),
	CONSTRAINT "evaluation_tests_applicability_check" CHECK ("evaluation_tests"."applicability" in ('APPLICABLE', 'NOT_APPLICABLE')),
	CONSTRAINT "evaluation_tests_status_check" CHECK ("evaluation_tests"."status" in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REOPENED')),
	CONSTRAINT "evaluation_tests_verdict_check" CHECK ("evaluation_tests"."verdict" in ('PASS', 'FAIL', 'INCOMPLETE', 'NOT_APPLICABLE'))
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"ref_no" text NOT NULL,
	"lab_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"sample_serials" text[],
	"spec_snapshot" jsonb NOT NULL,
	"rulepack_id" text NOT NULL,
	"rulepack_version" text NOT NULL,
	"engine_version" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"overall_verdict" text,
	"assigned_tester_id" uuid,
	"created_by" uuid NOT NULL,
	"due_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(ref_no, ''))) STORED,
	CONSTRAINT "evaluations_ref_no_unique" UNIQUE("ref_no"),
	CONSTRAINT "evaluations_status_check" CHECK ("evaluations"."status" in ('DRAFT', 'PLANNED', 'IN_TESTING', 'PENDING_T1', 'PENDING_T2', 'PENDING_T3', 'ISSUED', 'RETURNED', 'REVOKED', 'AMENDING', 'CANCELLED')),
	CONSTRAINT "evaluations_priority_check" CHECK ("evaluations"."priority" in ('normal', 'urgent')),
	CONSTRAINT "evaluations_verdict_check" CHECK ("evaluations"."overall_verdict" in ('CONFORMS', 'DOES_NOT_CONFORM', 'INCOMPLETE'))
);
--> statement-breakpoint
CREATE TABLE "lab_members" (
	"user_id" uuid NOT NULL,
	"lab_id" uuid NOT NULL,
	CONSTRAINT "lab_members_user_id_lab_id_pk" PRIMARY KEY("user_id","lab_id")
);
--> statement-breakpoint
CREATE TABLE "labs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"state" text,
	"accreditation_no" text,
	"logo_key" text,
	"report_prefix" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "applicants" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"contact_name" text,
	"email" text,
	"phone" text,
	"manufacturer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instrument_models" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"model_name" text NOT NULL,
	"variant_names" text[],
	"instrument_type" text NOT NULL,
	"description" text,
	"default_spec" jsonb,
	"modules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instrument_models_manufacturer_model_unique" UNIQUE("manufacturer_id","model_name"),
	CONSTRAINT "instrument_models_type_check" CHECK ("instrument_models"."instrument_type" in ('bench', 'counter', 'platform', 'weighbridge', 'crane', 'precision', 'analytical', 'hanging', 'other'))
);
--> statement-breakpoint
CREATE TABLE "manufacturers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"country" text,
	"contact_name" text,
	"email" text,
	"phone" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"report_version_id" uuid NOT NULL,
	"tier" smallint NOT NULL,
	"decision" text NOT NULL,
	"user_id" uuid NOT NULL,
	"comment" text,
	"model_sha256" char(64) NOT NULL,
	"step_up_verified" boolean DEFAULT false NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_decision_check" CHECK ("approvals"."decision" in ('APPROVED', 'RETURNED', 'REJECTED')),
	CONSTRAINT "approvals_tier_check" CHECK ("approvals"."tier" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"report_id" uuid NOT NULL,
	"version" text NOT NULL,
	"model" jsonb NOT NULL,
	"model_sha256" char(64) NOT NULL,
	"pdf_key" text,
	"pdf_sha256" char(64),
	"docx_key" text,
	"change_summary" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_versions_report_version_unique" UNIQUE("report_id","version"),
	CONSTRAINT "report_versions_status_check" CHECK ("report_versions"."status" in ('DRAFT', 'SIGNED', 'SUPERSEDED'))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"report_no" text NOT NULL,
	"certificate_no" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_version_id" uuid,
	"issued_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	CONSTRAINT "reports_evaluation_id_unique" UNIQUE("evaluation_id"),
	CONSTRAINT "reports_report_no_unique" UNIQUE("report_no"),
	CONSTRAINT "reports_certificate_no_unique" UNIQUE("certificate_no"),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('DRAFT', 'IN_REVIEW', 'ISSUED', 'REVOKED', 'SUPERSEDED'))
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"report_version_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "share_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_sequences" (
	"lab_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"kind" text NOT NULL,
	"next_val" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "number_sequences_lab_id_year_kind_pk" PRIMARY KEY("lab_id","year","kind"),
	CONSTRAINT "number_sequences_kind_check" CHECK ("number_sequences"."kind" in ('EVAL', 'REPORT', 'CERT'))
);
--> statement-breakpoint
CREATE TABLE "rulepacks" (
	"id" text NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"content_sha256" char(64) NOT NULL,
	"created_by" uuid NOT NULL,
	"published_by" uuid,
	"confirmed_by" uuid,
	"published_at" timestamp with time zone,
	CONSTRAINT "rulepacks_id_version_pk" PRIMARY KEY("id","version"),
	CONSTRAINT "rulepacks_status_check" CHECK ("rulepacks"."status" in ('DRAFT', 'PUBLISHED', 'RETIRED'))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_readings" ADD CONSTRAINT "env_readings_sensor_id_env_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."env_sensors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_readings" ADD CONSTRAINT "env_readings_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_sensors" ADD CONSTRAINT "env_sensors_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_weight_sets" ADD CONSTRAINT "reference_weight_sets_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_test_id_evaluation_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."evaluation_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_test_id_evaluation_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."evaluation_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_tests" ADD CONSTRAINT "evaluation_tests_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_tests" ADD CONSTRAINT "evaluation_tests_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_model_id_instrument_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."instrument_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_assigned_tester_id_user_id_fk" FOREIGN KEY ("assigned_tester_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_members" ADD CONSTRAINT "lab_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_members" ADD CONSTRAINT "lab_members_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_models" ADD CONSTRAINT "instrument_models_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rulepacks" ADD CONSTRAINT "rulepacks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rulepacks" ADD CONSTRAINT "rulepacks_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rulepacks" ADD CONSTRAINT "rulepacks_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "env_readings_lab_ts_idx" ON "env_readings" USING btree ("lab_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reference_weight_sets_lab_idx" ON "reference_weight_sets" USING btree ("lab_id");--> statement-breakpoint
CREATE INDEX "evaluations_lab_status_idx" ON "evaluations" USING btree ("lab_id","status");--> statement-breakpoint
CREATE INDEX "evaluations_search_idx" ON "evaluations" USING gin ("search");