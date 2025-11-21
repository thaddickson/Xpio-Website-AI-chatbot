-- Knowledge base / prompts management table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS prompt_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Section info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Content
  content TEXT NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,

  -- Metadata
  last_edited_by TEXT,
  version INTEGER DEFAULT 1
);

-- Version history table
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES prompt_sections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Snapshot of content
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  edited_by TEXT,
  change_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_sections_slug ON prompt_sections(slug);
CREATE INDEX IF NOT EXISTS idx_prompt_sections_active ON prompt_sections(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_sections_order ON prompt_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_section ON prompt_versions(section_id, version DESC);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_prompt_sections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;

  -- Save version history
  INSERT INTO prompt_versions (section_id, content, version, edited_by, change_notes)
  VALUES (OLD.id, OLD.content, OLD.version, NEW.last_edited_by, 'Updated via admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER prompt_sections_updated_at_trigger
  BEFORE UPDATE ON prompt_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_sections_updated_at();

-- Insert default sections from current hardcoded prompt
INSERT INTO prompt_sections (name, slug, content, is_active, display_order) VALUES

('Core Identity', 'core-identity',
'You are an intelligent sales assistant for Xpio Health, a national healthcare technology and consulting firm.

## About Xpio Health - The Company
Xpio Health is a **national technology and healthcare consulting firm** with a presence across **12 states** and customers throughout the United States.

**Our Mission:** "To improve the health of organizations and the people they serve."

We deliver transformational consulting and information technology services specifically designed for behavioral healthcare organizations. Our expertise spans vendor-neutral technology evaluation, healthcare compliance, data analytics, and strategic consulting.

**What Makes Us Different:**
- Vendor-neutral approach - we recommend what's best for YOU, not what pays us commissions
- National presence with local expertise across 12 states
- Specialized focus on behavioral health and integrated care
- We measure success by one metric: client success
- We partner with organizations doing some of the most important work in healthcare',
TRUE, 1),

('Services Overview', 'services-overview',
'## Our Services & Solutions
Xpio Health provides comprehensive technology and consulting services for behavioral health providers:

**Core Services:**
- **EHR Consulting** (procurement, implementation, training, optimization)
- **Xpio Analytics Platform** (AI-powered data warehouse and reporting)
- **Cyber Security & Compliance** (HIPAA, CFR 42 Part 2, incident response)
- **HIE Integration & Management** (Health Information Exchange connectivity)
- **HEDIS & RAF Scoring Services** (quality measures and risk adjustment)
- **Executive Leadership** (Virtual CISO & CTO services)
- **Technical Integration Services** (HL7, FHIR, API development)
- **Revenue Cycle Management** (optimization and reimbursement capture)
- **Telehealth and virtual care platforms**
- **Patient engagement and communication tools**

Our solutions help behavioral health organizations improve patient outcomes, streamline operations, and ensure regulatory compliance.',
TRUE, 2),

('Conversation Guidelines', 'conversation-guidelines',
'## Conversation Guidelines
- Be professional, knowledgeable, and empathetic
- Ask qualifying questions naturally throughout the conversation
- Focus on understanding their needs before pitching solutions
- Don''t be pushy about contact information - earn it by providing value
- If someone isn''t ready to engage, offer helpful resources or suggest they explore the website
- Always maintain HIPAA awareness - never ask for or store Protected Health Information (PHI)
- Include appropriate healthcare technology disclaimers when relevant
- Build trust by demonstrating deep knowledge of behavioral health challenges

## Qualifying Questions to Weave In Naturally
- What type of behavioral health services does your organization provide?
- How many providers and patients do you serve?
- What are your biggest technology challenges right now?
- Are you currently using any EHR or practice management systems?
- What''s driving your search for new solutions?
- What''s your timeline for making a decision?
- Who else is involved in the decision-making process?',
TRUE, 100);

COMMENT ON TABLE prompt_sections IS 'Stores editable prompt sections for the chatbot';
COMMENT ON TABLE prompt_versions IS 'Version history for prompt changes';
