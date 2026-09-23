-- Gram Panchayat property tax database (MySQL)
-- Redesigned for year-wise storage. Replaces the old Access `anandoldnew`
-- table (which hard-coded one pair of years via O-prefixed / plain columns)
-- with a normalized financial_years + property_tax_assessment pair, so any
-- number of years can be added without schema changes.

CREATE DATABASE IF NOT EXISTS gpweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gpweb;

-- ---------------------------------------------------------------------
-- Users (web login - the original desktop app had no auth)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- यूजर मास्टर व अधिकार (User Master / Rights) - role='admin' ला नेहमी सर्व
-- अधिकार असतात (bypass, पहा src/middleware/permissions.js); बाकीच्या
-- (role='user') वापरकर्त्यांसाठी प्रत्येक स्क्रीन/बटणासाठी वेगळी नोंद न
-- केलेली कृती डीफॉल्टने नाकारली जाते (allowed नसलेली जोडी = no access).
CREATE TABLE IF NOT EXISTS user_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  screen_code VARCHAR(50) NOT NULL,
  action_code VARCHAR(20) NOT NULL,
  allowed TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_user_screen_action (user_id, screen_code, action_code),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- मिळकतदार मास्टर (GPMASTER) - कोड ते मालकाचे नांव अशी कायमस्वरूपी यादी.
-- मूळ जुन्या Access प्रणालीतील gpmaster टेबलावरून एकवेळ आयात केली (पहा
-- backend/scripts/gpmasterImport.js व gpmasterSeed.js); आता स्वतंत्र स्क्रीनवरून
-- (add/edit/delete) हाताळता येते आणि नवीन मिळकत नोंद भरताना कोड टाकल्यावर
-- मालकाचे नांव इथूनच आपोआप भरले जाते (पहा routes/gpmaster.routes.js).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gpmaster (
  code INT PRIMARY KEY,
  owner_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- GP identity (नाव/तालुका/जिल्हा) - the old Crystal Reports had these
-- hardcoded into each .rpt file. Single-row settings table so printed
-- forms (नमुना नं. ८, receipts, ...) can show the GP's own letterhead
-- details without editing code.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gp_settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  gp_name VARCHAR(150) NOT NULL DEFAULT '',
  taluka VARCHAR(100) NOT NULL DEFAULT '',
  district VARCHAR(100) NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_gp_settings_single_row CHECK (id = 1)
) ENGINE=InnoDB;
INSERT INTO gp_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id;

-- ---------------------------------------------------------------------
-- Financial years (was: implicit in anandoldnew's O-prefixed vs plain
-- columns). Add a new row here whenever a new assessment year starts.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year_label VARCHAR(20) NOT NULL UNIQUE,   -- e.g. '2023-2024'
  start_date DATE NULL,
  end_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Particular / construction-type rate master (was: GP_PARTICULAR_MASTER)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS particular_master (
  par_code INT PRIMARY KEY,
  par_name VARCHAR(255) NOT NULL DEFAULT '',
  gharpatti_rate DECIMAL(10,3) NOT NULL DEFAULT 0,   -- garphati_rate / KARACHA_RATE seed
  jamin_rate DECIMAL(14,2) NOT NULL DEFAULT 0,       -- MJAMIN
  divabatti_rate DECIMAL(10,2) NOT NULL DEFAULT 0,   -- MDIVABATI
  arogya_rate DECIMAL(10,2) NOT NULL DEFAULT 0,      -- MAROGYA
  panipatti_rate DECIMAL(10,2) NOT NULL DEFAULT 0,   -- MPNINAPTI
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Property master (was: gpmaster). One row per taxable property/portion.
--
-- NOTE ON `property_code`: in the source Access database this was meant
-- to be the unique key (as in gp_master), but the real data has only 914
-- distinct `code` values across 1256 rows in anandoldnew (duplicates from
-- years of manual entry). To avoid silently losing/merging real citizen
-- records, this table uses a surrogate `id` as the true primary key and
-- keeps `property_code` as an indexed business reference field.
-- The API enforces uniqueness of property_code only for NEW records
-- created going forward; legacy duplicates are preserved as-is.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_code INT NULL,                 -- legacy `code`
  srno INT NULL,                          -- legacy SRNO
  malmata_no VARCHAR(50) NULL,
  particulars VARCHAR(255) NULL,
  construction_type INT NULL,             -- legacy T -> particular_master.par_code
  owner_name VARCHAR(255) NULL,
  bhogvatdar VARCHAR(255) NULL,           -- occupant / bhogvatdar
  milkat_year VARCHAR(20) NULL,           -- legacy free-text field, kept for reference
  is_government TINYINT(1) NOT NULL DEFAULT 0,
  narration TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_property_code (property_code),
  INDEX idx_srno (srno),
  INDEX idx_owner_name (owner_name),
  INDEX idx_malmata_no (malmata_no),
  CONSTRAINT fk_property_construction_type FOREIGN KEY (construction_type)
    REFERENCES particular_master(par_code) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Year-wise tax assessment (was: anandoldnew's OGAHARPATI/GAHARPATI etc.
-- wide columns, one pair of years hard-coded into the schema).
-- Now: one row per (property, financial_year). Adding a new year is just
-- a new financial_years row + new assessment rows - no schema change.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_tax_assessment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  financial_year_id INT NOT NULL,

  new_length DECIMAL(10,2) NOT NULL DEFAULT 0,     -- NEWL
  new_width DECIMAL(10,2) NOT NULL DEFAULT 0,      -- NEWW
  area_sqft DECIMAL(14,2) NOT NULL DEFAULT 0,      -- C_F = NEWL * NEWW
  area_sqm DECIMAL(14,2) NOT NULL DEFAULT 0,       -- C_M = C_F / 10.76
  jamin_rate_used DECIMAL(14,2) NOT NULL DEFAULT 0,-- RJAMIN at entry time
  gasara_rate DECIMAL(10,3) NOT NULL DEFAULT 0,
  bharank DECIMAL(10,3) NOT NULL DEFAULT 0,
  bhandvalimula_rs DECIMAL(16,2) NOT NULL DEFAULT 0, -- capital value
  karacha_rate DECIMAL(10,3) NOT NULL DEFAULT 0,

  gharpatti DECIMAL(14,2) NOT NULL DEFAULT 0,   -- house tax (garpati)
  divabatti DECIMAL(14,2) NOT NULL DEFAULT 0,   -- street-light tax
  arogya DECIMAL(14,2) NOT NULL DEFAULT 0,      -- health/sanitation tax
  panipatti DECIMAL(14,2) NOT NULL DEFAULT 0,   -- water tax
  total_tax DECIMAL(16,2) NOT NULL DEFAULT 0,   -- gharpatti+divabatti+arogya+panipatti

  gov_status TINYINT NOT NULL DEFAULT 0,  -- 0=unset, 1=government property, 2=not government
  narration TEXT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_property_year (property_id, financial_year_id),
  INDEX idx_financial_year (financial_year_id),
  CONSTRAINT fk_assessment_property FOREIGN KEY (property_id)
    REFERENCES property_master(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_year FOREIGN KEY (financial_year_id)
    REFERENCES financial_years(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tax collection (कर जमा). One row per payment/receipt against a property.
--
-- There is deliberately no per-component/per-year allocation stored here.
-- A payment is just an amount + date against a property; which specific
-- dues (मागील घरपट्टी, मागील दिवाबत्ती, ... चालू पाणीपट्टी) it covers is
-- computed on read (see src/utils/dueAllocation.js) by walking the fixed
-- priority order - previous years first, then the selected current year,
-- each in घरपट्टी/दिवाबत्ती/आरोग्य/पाणीपट्टी order - and consuming the
-- cumulative paid total against it. This keeps "outstanding" correct
-- automatically as new financial years get added later, with no ledger
-- migration needed.
-- ---------------------------------------------------------------------
-- receipt_type + receipt_no: प्रत्यक्ष कागदी पावती पुस्तकांप्रमाणे घरपट्टी
-- (नमुना १०, घरपट्टी+दिवाबत्ती+आरोग्य कर) आणि पाणीपट्टी (नमुना १०, वेगळे
-- पुस्तक) या दोन स्वतंत्र पावती-मालिका आहेत, प्रत्येकीचा स्वतःचा वाढत
-- जाणारा receipt_no. FIFO वाटप (allocate) आता या दोन गटांसाठी स्वतंत्रपणे
-- चालते (पहा utils/dueAllocation.js: GHARPATTI_GROUP_ORDER / PANIPATTI_GROUP_ORDER) -
-- घरपट्टी पावतीचा पैसा फक्त घरपट्टी/दिवाबत्ती/आरोग्य बाकीतून वसूल होतो,
-- पाणीपट्टी पावतीचा पैसा फक्त पाणीपट्टी बाकीतून.
-- खुली जागा कर/नोटीस फी/वारंट फी/इतर - या घटकांची वर्षनिहाय आकारणी
-- (property_tax_assessment) प्रणालीत नाही, त्यामुळे यांची बाकी आपोआप न
-- काढता दर पावतीच्या वेळी जेवढी रक्कम प्रत्यक्ष घेतली तेवढीच नोंदवली जाते
-- (थेट रक्कम, FIFO वाटपाचा भाग नाही) आणि पावतीवर स्वतंत्रपणे छापली जाते.
CREATE TABLE IF NOT EXISTS tax_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  financial_year_id INT NOT NULL,   -- "चालू वर्ष" context in effect when this payment was recorded
  payment_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,    -- FIFO-वाटपासाठी पात्र रक्कम (घरपट्टी/दिवाबत्ती/आरोग्य किंवा पाणीपट्टी बाकीविरुद्ध)
  receipt_type VARCHAR(20) NOT NULL DEFAULT 'gharpatti',   -- 'gharpatti' | 'panipatti'
  receipt_no INT NOT NULL DEFAULT 1,                       -- receipt_type नुसार स्वतंत्र क्रमांक
  khuli_jaga_amount DECIMAL(10,2) NOT NULL DEFAULT 0,      -- फक्त gharpatti पावतीवर
  notice_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0,      -- दोन्ही प्रकारच्या पावतीवर
  warrant_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0,     -- फक्त gharpatti पावतीवर
  other_amount DECIMAL(10,2) NOT NULL DEFAULT 0,           -- फक्त panipatti पावतीवर ("इतर")
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash',        -- 'cash' | 'cheque' | 'upi' - नमुना १० वरील जमा प्रकार
  bank_name VARCHAR(150) NULL,                             -- फक्त cheque साठी
  cheque_no VARCHAR(50) NULL,                              -- फक्त cheque साठी
  narration VARCHAR(255) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_property (property_id),
  INDEX idx_payment_year (financial_year_id),
  UNIQUE KEY uq_receipt_type_no (receipt_type, receipt_no),
  CONSTRAINT fk_payment_property FOREIGN KEY (property_id)
    REFERENCES property_master(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_year FOREIGN KEY (financial_year_id)
    REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_user FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Convenience view: per-owner (कोड / property_code) roll-up across all
-- portions for a given year (was: anandoldnew_total, previously rebuilt
-- by hand via a button in Form4; grouping switched from SRNO to
-- property_code per user request - मालमत्ता क्रं. now the sub-group under
-- कोड, so one owner's multiple properties roll up together). Now always live.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW property_tax_summary_view AS
SELECT
  a.financial_year_id,
  fy.year_label,
  pm.property_code,
  MAX(pm.owner_name) AS owner_name,
  GROUP_CONCAT(DISTINCT pm.malmata_no ORDER BY pm.malmata_no SEPARATOR ', ') AS malmata_no_list,
  COUNT(*) AS portion_count,
  SUM(a.gharpatti) AS total_gharpatti,
  SUM(a.divabatti) AS total_divabatti,
  SUM(a.arogya) AS total_arogya,
  SUM(a.panipatti) AS total_panipatti,
  SUM(a.total_tax) AS grand_total
FROM property_tax_assessment a
JOIN property_master pm ON pm.id = a.property_id
JOIN financial_years fy ON fy.id = a.financial_year_id
GROUP BY a.financial_year_id, fy.year_label, pm.property_code;

-- ---------------------------------------------------------------------
-- ग्रामपंचायत लेखा संहिता, २०११ - नमुना १ ते ३३ (फेज १: लेजर पाया).
-- लेखाशीर्ष (ledger_heads) हा कायद्याने ठरलेला स्थिर वृक्ष (नमुना १ चे
-- एक(अ)/एक(ब)/एक(क)/दोन/तीन/चार असे गट) - एकदाच seedLedgerHeads.js ने
-- भरतो, स्वतंत्र UI ने बांधकाम/काढकाम करण्यासाठी नाही (फक्त नाव-बदल).
-- cash_book_entries (नमुना ५, दैनिक रोकड वही) ही खरी व्यवहार नोंद; नमुना ६
-- (वर्गीकृत नोंदवही) ही त्यावरूनच काढलेला रिपोर्ट आहे, वेगळा साठा नाही.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_heads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  group_type ENUM('जमा','खर्च') NOT NULL,
  parent_id INT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_leaf TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_ledger_head_parent FOREIGN KEY (parent_id)
    REFERENCES ledger_heads(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cash_book_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year_id INT NOT NULL,
  entry_date DATE NOT NULL,
  ledger_head_id INT NOT NULL,
  entry_type ENUM('जमा','खर्च') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  payment_mode ENUM('रोख','धनादेश') NOT NULL DEFAULT 'रोख',
  reference_no VARCHAR(50) NULL,
  reference_date DATE NULL,
  bank_deposit_date DATE NULL,
  narration TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cash_entry_date (entry_date),
  INDEX idx_cash_entry_head (ledger_head_id),
  CONSTRAINT fk_cash_entry_year FOREIGN KEY (financial_year_id)
    REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cash_entry_head FOREIGN KEY (ledger_head_id)
    REFERENCES ledger_heads(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cash_entry_user FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- नमुना ४ (पंचायतीचे भत्ते व दायित्वे) - वर्षनिहाय, कागदी नमुन्यावरील
-- प्रत्येक ओळीसाठी एक रक्कम (मुख्यतः हाताने भरायची, वेगळ्या व्यवहार
-- नोंदींवरून काढता येण्यासारखी नाही - gp_settings प्रमाणेच साधी रचना).
CREATE TABLE IF NOT EXISTS assets_liabilities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year_id INT NOT NULL,
  side ENUM('दायित्वे','भत्ता') NOT NULL,
  item_code VARCHAR(10) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_assets_liabilities_item (financial_year_id, side, item_code),
  CONSTRAINT fk_assets_liabilities_year FOREIGN KEY (financial_year_id)
    REFERENCES financial_years(id) ON DELETE CASCADE
) ENGINE=InnoDB;
