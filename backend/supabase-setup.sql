CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  organization VARCHAR(255),
  role VARCHAR(255),
  organization_size VARCHAR(100),
  primary_interest TEXT NOT NULL,
  current_systems TEXT,
  timeline VARCHAR(100),
  budget_range VARCHAR(100),
  pain_points TEXT,
  conversation_summary TEXT NOT NULL,
  qualification_score VARCHAR(20) NOT NULL,
  next_steps TEXT,
  conversation_history JSONB NOT NULL,
  source VARCHAR(50) DEFAULT 'website_chatbot',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  followed_up BOOLEAN DEFAULT FALSE,
  followed_up_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_qualification ON leads(qualification_score);
CREATE INDEX IF NOT EXISTS idx_leads_followed_up ON leads(followed_up);
