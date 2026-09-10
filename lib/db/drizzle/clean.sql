CREATE TYPE "public"."whatsapp_session_state" AS ENUM('awaiting_template_selection', 'awaiting_client_choice', 'awaiting_job_input', 'awaiting_confirmation', 'awaiting_client_data', 'menu_main', 'menu_clients', 'menu_template', 'menu_iva');
CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'done', 'error');
CREATE TABLE "quote_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" numeric(15, 0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"client_data" jsonb DEFAULT '{"nome":"","indirizzo":""}'::jsonb NOT NULL,
	"descrizione_generale" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capitoli" jsonb DEFAULT '[]'::jsonb,
	"sconto" jsonb,
	"condizioni_pagamento" text[] DEFAULT '{}',
	"titolo_preventivo_riga1" text DEFAULT 'Analisi Economica e Computo Metrico Prezzato',
	"titolo_preventivo_riga2" text DEFAULT '',
	"numero_preventivo_data" text DEFAULT '',
	"company_snapshot" jsonb,
	"subtotale" numeric(10, 2) DEFAULT '0' NOT NULL,
	"iva_percentuale" numeric(5, 2) DEFAULT '22' NOT NULL,
	"iva_valore" numeric(10, 2) DEFAULT '0' NOT NULL,
	"totale" numeric(10, 2) DEFAULT '0' NOT NULL,
	"note" text DEFAULT 'Preventivo valido 30 giorni' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"pdf_url" text,
	"raw_input" text DEFAULT '' NOT NULL,
	"stripe_session_id" text,
	"unlocked_with_plan" text,
	"capitolato_pro" boolean DEFAULT false NOT NULL,
	"capitolato_pdf_url" text,
	"template_id" text DEFAULT 'standard',
	"pdf_downloaded_at" timestamp with time zone,
	"source" text DEFAULT 'web',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "business_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"vat_number" text,
	"address" text,
	"logo_url" text,
	"phone" text,
	"email" text,
	"stripe_customer_id" text,
	"subscription_plan" text,
	"subscription_status" text,
	"subscription_period_end" timestamp with time zone,
	"trial_started_at" timestamp with time zone,
	"trial_downloads_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "price_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome" text NOT NULL,
	"categoria" text,
	"um" text DEFAULT 'cad' NOT NULL,
	"prezzo_unitario" numeric(10, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);

CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);

CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "whatsapp_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"phone_number" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "whatsapp_connections_phone_number_unique" UNIQUE("phone_number")
);

CREATE TABLE "whatsapp_otp" (
	"phone_number" text PRIMARY KEY NOT NULL,
	"otp" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "whatsapp_sessions" (
	"phone_number" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"state" "whatsapp_session_state" NOT NULL,
	"pending_quote_data" jsonb NOT NULL,
	"iteration_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "price_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"work_type" text NOT NULL,
	"unit_price" text NOT NULL,
	"unit" text,
	"zone" text,
	"source_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "uploaded_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text NOT NULL,
	"file_url" text NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"extracted_data" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "quote_attachments" ADD CONSTRAINT "quote_attachments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "whatsapp_otp" ADD CONSTRAINT "whatsapp_otp_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "price_intelligence" ADD CONSTRAINT "price_intelligence_source_document_id_uploaded_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."uploaded_documents"("id") ON DELETE cascade ON UPDATE no action;
