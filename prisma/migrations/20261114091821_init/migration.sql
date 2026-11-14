-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PROCUREMENT_MANAGER', 'APPROVER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SOURCING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'PENDING', 'NON_COMPLIANT');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'NOT_SELECTED');

-- CreateEnum
CREATE TYPE "ExtractionSource" AS ENUM ('AI', 'MANUAL', 'AI_CORRECTED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'EXTRACTED', 'FAILED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CLARIFICATION', 'COMMENT', 'RESUBMIT', 'CANCEL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'TERMINATED');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "demo_mode" BOOLEAN NOT NULL DEFAULT true,
    "default_weights" JSONB NOT NULL DEFAULT '{"price":35,"delivery":20,"quality":20,"reliability":15,"payment":10}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "title" TEXT,
    "role" "Role" NOT NULL DEFAULT 'APPROVER',
    "department_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "annual_budget" DECIMAL(14,2),
    "head_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_amount" DECIMAL(14,2) NOT NULL,
    "max_amount" DECIMAL(14,2),
    "levels" INTEGER NOT NULL DEFAULT 1,
    "second_level_role" "Role" DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "estimated_budget" DECIMAL(14,2) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "required_by" DATE,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "scoring_weights" JSONB,
    "recommended_vendor_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_items" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "estimated_unit_price" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_documents" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_request_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "category" TEXT NOT NULL,
    "tax_id" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "performance_rating" INTEGER,
    "delivery_reliability" INTEGER,
    "compliance_status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'RECEIVED',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(14,2),
    "tax_amount" DECIMAL(14,2),
    "additional_charges" DECIMAL(14,2),
    "total_amount" DECIMAL(14,2),
    "delivery_days" INTEGER,
    "payment_terms" TEXT,
    "warranty_months" INTEGER,
    "validity_date" DATE,
    "notes" TEXT,
    "extraction_source" "ExtractionSource" NOT NULL DEFAULT 'MANUAL',
    "extraction_confidence" INTEGER,
    "extraction_model" TEXT,
    "extracted_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_documents" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "extracted_text" TEXT,
    "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extraction_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_evaluations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "request_id" TEXT,
    "quotation_id" TEXT,
    "evaluator_id" TEXT NOT NULL,
    "quality_score" INTEGER NOT NULL,
    "delivery_score" INTEGER NOT NULL,
    "compliance_score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approver_id" TEXT NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'WAITING',
    "activated_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "step_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "renewal_date" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "document_key" TEXT,
    "document_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "request_id" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_org_id_role_idx" ON "profiles"("org_id", "role");

-- CreateIndex
CREATE INDEX "profiles_department_id_idx" ON "profiles"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_head_id_key" ON "departments"("head_id");

-- CreateIndex
CREATE INDEX "departments_org_id_idx" ON "departments"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_org_id_code_key" ON "departments"("org_id", "code");

-- CreateIndex
CREATE INDEX "approval_workflows_org_id_is_active_idx" ON "approval_workflows"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "purchase_requests_org_id_status_idx" ON "purchase_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "purchase_requests_org_id_created_at_idx" ON "purchase_requests"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_requests_department_id_idx" ON "purchase_requests"("department_id");

-- CreateIndex
CREATE INDEX "purchase_requests_requester_id_idx" ON "purchase_requests"("requester_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_org_id_reference_key" ON "purchase_requests"("org_id", "reference");

-- CreateIndex
CREATE INDEX "purchase_request_items_request_id_idx" ON "purchase_request_items"("request_id");

-- CreateIndex
CREATE INDEX "purchase_request_documents_request_id_idx" ON "purchase_request_documents"("request_id");

-- CreateIndex
CREATE INDEX "vendors_org_id_status_idx" ON "vendors"("org_id", "status");

-- CreateIndex
CREATE INDEX "vendors_org_id_category_idx" ON "vendors"("org_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_org_id_name_key" ON "vendors"("org_id", "name");

-- CreateIndex
CREATE INDEX "quotations_org_id_idx" ON "quotations"("org_id");

-- CreateIndex
CREATE INDEX "quotations_request_id_idx" ON "quotations"("request_id");

-- CreateIndex
CREATE INDEX "quotations_vendor_id_idx" ON "quotations"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_request_id_vendor_id_key" ON "quotations"("request_id", "vendor_id");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_documents_quotation_id_idx" ON "quotation_documents"("quotation_id");

-- CreateIndex
CREATE INDEX "vendor_evaluations_vendor_id_idx" ON "vendor_evaluations"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_evaluations_org_id_idx" ON "vendor_evaluations"("org_id");

-- CreateIndex
CREATE INDEX "approval_steps_approver_id_status_idx" ON "approval_steps"("approver_id", "status");

-- CreateIndex
CREATE INDEX "approval_steps_request_id_idx" ON "approval_steps"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_request_id_level_key" ON "approval_steps"("request_id", "level");

-- CreateIndex
CREATE INDEX "approval_actions_request_id_created_at_idx" ON "approval_actions"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "contracts_org_id_end_date_idx" ON "contracts"("org_id", "end_date");

-- CreateIndex
CREATE INDEX "contracts_vendor_id_idx" ON "contracts"("vendor_id");

-- CreateIndex
CREATE INDEX "activities_org_id_created_at_idx" ON "activities"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "activities_request_id_created_at_idx" ON "activities"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_created_at_idx" ON "audit_logs"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_recommended_vendor_id_fkey" FOREIGN KEY ("recommended_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_documents" ADD CONSTRAINT "purchase_request_documents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_documents" ADD CONSTRAINT "purchase_request_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "approval_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
