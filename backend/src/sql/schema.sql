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

-- फेज ३अ: नमुना १८ (किरकोळ रोकडवही) नमुना ५ शी सर्वस्वी सारखी रचना आहे -
-- वेगळी टेबल/UI बनवण्याऐवजी फक्त कोणत्या रोकडवहीची नोंद आहे ते सांगणारा
-- स्तंभ जोडला (मुख्य=नमुना ५, किरकोळ=नमुना १८); जुन्या सर्व नोंदी आपोआप
-- 'मुख्य' राहतात, त्यामुळे नमुना ५/६/३/२६-क चे आधीचे वर्तन बदलत नाही.
ALTER TABLE cash_book_entries
  ADD COLUMN IF NOT EXISTS register ENUM('मुख्य','किरकोळ') NOT NULL DEFAULT 'मुख्य' AFTER entry_type;

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

-- फेज २: नमुना १ (वार्षिक अंदाजपत्रक) व नमुना २ (पुनर्विनियोजन). budget_entries
-- प्रत्येक leaf लेखाशीर्षासाठी (नमुना १ कॉलम २/३ - प्रस्तावित/मंजूर); मागील
-- वर्ष/गतपूर्व वर्षाची प्रत्यक्ष रक्कम cash_book_entries वरून काढलेली, साठवलेली
-- नाही. budget_revisions फक्त मुख्य गट (parent_id IS NULL) स्तरावर - कागदी
-- नमुना २ फक्त गट-स्तरावरच सुधारित अंदाज दाखवतो, प्रत्येक उप-शीर्षासाठी नाही.
CREATE TABLE IF NOT EXISTS budget_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year_id INT NOT NULL,
  ledger_head_id INT NOT NULL,
  proposed_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  approved_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_budget_year_head (financial_year_id, ledger_head_id),
  CONSTRAINT fk_budget_entry_year FOREIGN KEY (financial_year_id)
    REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_budget_entry_head FOREIGN KEY (ledger_head_id)
    REFERENCES ledger_heads(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS budget_revisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year_id INT NOT NULL,
  ledger_head_id INT NOT NULL,
  revised_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_revision_year_head (financial_year_id, ledger_head_id),
  CONSTRAINT fk_budget_revision_year FOREIGN KEY (financial_year_id)
    REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_budget_revision_head FOREIGN KEY (ledger_head_id)
    REFERENCES ledger_heads(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- फेज ३अ: नमुना १६ (जंगम), २२ (स्थावर), २३ (रस्ते), २४ (जमिनी) या चारही
-- मालमत्ता नोंदवह्या एकाच सामायिक टेबलमध्ये (category नुसार वेगळ्या) -
-- स्तंभ-रचना जवळपास सारखीच आहे. स्थावर/रस्ते/जमीन च्या बेरजा नमुना ४ च्या
-- A6/A7/A8 ओळींना पुरवतात (त्या ओळी आता इथून आपोआप काढल्या जातात, वेगळ्या
-- हाताने टाईप करायच्या नाहीत - डुप्लिकेट नोंद टाळण्यासाठी). जंगम (नमुना १६)
-- ला नमुना ४ मध्ये जुळणारी ओळ नाही, ती फक्त स्वतंत्र नोंदवही म्हणून राहते.
CREATE TABLE IF NOT EXISTS fixed_assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('जंगम','स्थावर','रस्ते','जमीन') NOT NULL,
  description VARCHAR(255) NOT NULL,
  acquired_date DATE NULL,
  acquired_mode VARCHAR(150) NULL,
  quantity_or_measure VARCHAR(150) NULL,
  cost_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  disposal_date DATE NULL,
  disposal_details TEXT NULL,
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fixed_assets_category (category)
) ENGINE=InnoDB;

-- फेज ३ब: नमुना १३ (कर्मचारी सूची व वेतनश्रेणी - स्थिर रोस्टर मास्टर) व
-- नमुना २१ (मासिक वेतन देयक नोंदवही - प्रति कर्मचारी/महिना). एकूण/निव्वळ
-- रक्कम साठवलेली नाही, नेहमी backend कडून गणित करून पाठवली जाते (staffSalaryBills
-- routes पहा). निव्वळ रक्कम रोकड वहीत (नमुना ५, लेखाशीर्ष K1.4) "पोस्ट करा"
-- कृतीने नोंदवता येते - रक्कम पुन्हा हाताने टाईप करायची गरज नाही
-- (cash_book_entry_id त्या नोंदीकडे निर्देश करतो, दुहेरी पोस्टिंग रोखते).
CREATE TABLE IF NOT EXISTS staff_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_name VARCHAR(150) NOT NULL,
  post_count INT NOT NULL DEFAULT 1,
  sanction_order_no VARCHAR(100) NULL,
  sanction_date DATE NULL,
  employment_type ENUM('पूर्णकालिक','अंशकालिक') NOT NULL DEFAULT 'पूर्णकालिक',
  pay_scale VARCHAR(150) NULL,
  employee_name VARCHAR(150) NULL,
  appointment_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS staff_salary_bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  financial_year_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  basic_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  leave_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  suspension_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
  recovery_fine DECIMAL(12,2) NOT NULL DEFAULT 0,
  pf_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_book_entry_id INT NULL,
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_salary_month (staff_id, financial_year_id, year, month),
  CONSTRAINT fk_salary_staff FOREIGN KEY (staff_id)
    REFERENCES staff_master(id) ON DELETE CASCADE,
  CONSTRAINT fk_salary_year FOREIGN KEY (financial_year_id)
    REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_salary_cash_entry FOREIGN KEY (cash_book_entry_id)
    REFERENCES cash_book_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- फेज ३क: नमुना १७ (अग्रिम/अनामत), २५ (गुंतवणूक), २९ (कर्ज) - तिन्ही आर्थिक
-- उप-नोंदवह्या. staff_salary_bills सारखाच नमुना: मूळ रक्कम भरून "पोस्ट करा"
-- केल्यावर cash_book_entries मध्ये एकच नोंद तयार होते (रक्कम दुसऱ्यांदा
-- टाईप करायची नाही); परतफेड/समायोजन/परिपक्वता झाल्यावर पुन्हा तीच कृती
-- उलट दिशेच्या cash_book_entries नोंदीसाठी वापरतात.

-- नमुना १७ - अग्रिम दिलेल्या/अनामत ठेवलेल्या रकमांची नोंदवही.
CREATE TABLE IF NOT EXISTS advance_deposit_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('अग्रिम','अनामत') NOT NULL,   -- अग्रिम=दिलेली रक्कम (खर्च); अनामत=ठेवलेली/मिळालेली रक्कम (जमा)
  party_name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  financial_year_id INT NOT NULL,
  entry_date DATE NOT NULL,
  ledger_head_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  cash_book_entry_id INT NULL,
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_adv_dep_year FOREIGN KEY (financial_year_id) REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_adv_dep_head FOREIGN KEY (ledger_head_id) REFERENCES ledger_heads(id) ON DELETE RESTRICT,
  CONSTRAINT fk_adv_dep_cash_entry FOREIGN KEY (cash_book_entry_id) REFERENCES cash_book_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS advance_deposit_settlements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  settlement_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  cash_book_entry_id INT NULL,   -- रोख हालचाल झाली तरच; निव्वळ समायोजन असेल तर रिकामे
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_adv_dep_settle_entry FOREIGN KEY (entry_id) REFERENCES advance_deposit_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_adv_dep_settle_cash_entry FOREIGN KEY (cash_book_entry_id) REFERENCES cash_book_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- नमुना २५ - गुंतवणूक नोंदवही (मुदत ठेव/राष्ट्रीय बचत/सरकारी रोखे).
CREATE TABLE IF NOT EXISTS investments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year_id INT NOT NULL,
  investment_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,        -- गुंतवणुकीचा तपशील (बँक/संस्था, प्रमाणपत्र क्र. इ.)
  purchase_price DECIMAL(14,2) NOT NULL,     -- दर्शनी मूल्य/खरेदी किंमत
  maturity_date DATE NULL,
  matured_amount DECIMAL(14,2) NULL,         -- परिणत होण्याची अपेक्षित/प्रत्यक्ष रक्कम
  ledger_head_id INT NOT NULL,
  cash_book_entry_id INT NULL,               -- गुंतवणूक केली (खर्च)
  is_matured TINYINT(1) NOT NULL DEFAULT 0,
  matured_cash_book_entry_id INT NULL,       -- परिपक्व/भरणा झाल्यावर मिळालेली रक्कम (जमा)
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_investment_year FOREIGN KEY (financial_year_id) REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_investment_head FOREIGN KEY (ledger_head_id) REFERENCES ledger_heads(id) ON DELETE RESTRICT,
  CONSTRAINT fk_investment_cash_entry FOREIGN KEY (cash_book_entry_id) REFERENCES cash_book_entries(id) ON DELETE SET NULL,
  CONSTRAINT fk_investment_matured_cash_entry FOREIGN KEY (matured_cash_book_entry_id) REFERENCES cash_book_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- नमुना २९ - कर्जाची नोंदवही (पंचायतीने घेतलेले कर्ज, हप्त्यांसह).
CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year_id INT NOT NULL,
  source VARCHAR(150) NOT NULL,          -- कर्जाची उभारणीचे साधन
  sanction_order_no VARCHAR(100) NULL,
  sanction_date DATE NULL,
  purpose VARCHAR(255) NULL,             -- कर्जाचे प्रयोजन
  loan_amount DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(5,2) NULL,
  received_date DATE NULL,
  ledger_head_id INT NOT NULL,
  cash_book_entry_id INT NULL,           -- कर्ज मिळाले (जमा)
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_year FOREIGN KEY (financial_year_id) REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_loan_head FOREIGN KEY (ledger_head_id) REFERENCES ledger_heads(id) ON DELETE RESTRICT,
  CONSTRAINT fk_loan_cash_entry FOREIGN KEY (cash_book_entry_id) REFERENCES cash_book_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loan_repayments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  repayment_date DATE NOT NULL,
  principal_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  interest_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cash_book_entry_id INT NULL,           -- हप्ता भरला (खर्च)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_repay_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  CONSTRAINT fk_loan_repay_cash_entry FOREIGN KEY (cash_book_entry_id) REFERENCES cash_book_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- फेज ३ड: नमुना ३१ (प्रवास भत्ता देयक) - नोंद करताच cash_book_entries मध्ये
-- खर्च नोंदते (फेज ३क च्या नमुना १७/२५/२९ प्रमाणेच "तयार करा = लगेच पोस्ट
-- करा" पद्धत). नमुना ३२ (रकमेच्या परताव्यासाठीचा आदेश) साठी वेगळी टेबल
-- नाही - तो cash_book_entries च्या already-existing खर्च नोंदीचाच एक वेगळा
-- प्रिंट स्वरूप आहे (नमुना ७/१२ प्रमाणेच), backend/src/routes/cashBook.routes.js
-- मधील /:id/refund राऊट पहा.
CREATE TABLE IF NOT EXISTS travel_bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  traveller_name VARCHAR(150) NOT NULL,
  financial_year_id INT NOT NULL,
  travel_date DATE NOT NULL,
  from_place VARCHAR(150) NULL,
  to_place VARCHAR(150) NULL,
  purpose VARCHAR(255) NULL,
  fare_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  mileage_km DECIMAL(8,2) NOT NULL DEFAULT 0,
  mileage_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
  daily_allowance_days DECIMAL(5,2) NOT NULL DEFAULT 0,
  daily_allowance_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
  ledger_head_id INT NOT NULL,
  cash_book_entry_id INT NULL,
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_travel_bill_year FOREIGN KEY (financial_year_id) REFERENCES financial_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_travel_bill_head FOREIGN KEY (ledger_head_id) REFERENCES ledger_heads(id) ON DELETE RESTRICT,
  CONSTRAINT fk_travel_bill_cash_entry FOREIGN KEY (cash_book_entry_id) REFERENCES cash_book_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- फेज ३इ: लेखापरीक्षण. नमुना ३० (आक्षेप पूर्तता नोंदवही) व नमुना २७ (मासिक
-- विवरण) एकाच डेटावरून: audit_reports (प्रत्येक लेखापरीक्षण अहवालाची एक ओळ) व
-- audit_compliance_logs (पूर्ततेच्या प्रत्येक प्रगतीची तारीखवार नोंद). नमुना ३० चे
-- "एकूण पूर्तता/मंजूर" कॉलम व नमुना २७ चे मासिक आकडे दोन्ही logs वरून
-- काढले जातात - दोन्ही फॉर्मसाठी वेगळी नोंद करायची नाही.
CREATE TABLE IF NOT EXISTS audit_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_year VARCHAR(20) NOT NULL,          -- लेखापरीक्षण अहवालाचे वर्ष
  received_date DATE NULL,
  total_objections INT NOT NULL DEFAULT 0,   -- अहवालातील एकूण आक्षेप/परिच्छेद
  info_only_count INT NOT NULL DEFAULT 0,    -- केवळ माहितीसाठी (पूर्तता आवश्यक नाही)
  objection_numbers VARCHAR(255) NULL,
  outward_no VARCHAR(100) NULL,              -- पंचायत समितीकडे पाठविल्याचा जावक क्र. व दिनांक
  ps_resolution_info VARCHAR(255) NULL,      -- पंचायत समितीचा ठराव/जावक तपशील
  rem_book_adjustment INT NOT NULL DEFAULT 0,  -- शिल्लक आक्षेप: पुस्तकी समायोजन
  rem_recovery INT NOT NULL DEFAULT 0,         -- वसुली
  rem_valuation INT NOT NULL DEFAULT 0,        -- मूल्यांकन
  rem_irregular INT NOT NULL DEFAULT 0,        -- नियमबाह्य
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_compliance_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  audit_report_id INT NOT NULL,
  log_date DATE NOT NULL,
  complied_count INT NOT NULL DEFAULT 0,          -- ग्रामपंचायतीने पूर्तता केलेले
  ps_accepted_count INT NOT NULL DEFAULT 0,       -- पंचायत समितीने मान्य केलेले
  auditor_accepted_count INT NOT NULL DEFAULT 0,  -- जि.प./लेखा परीक्षकाने मंजूर केलेले
  pending_reason TEXT NULL,
  remark TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_log_report FOREIGN KEY (audit_report_id) REFERENCES audit_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- नमुना २६-ख: मासिक शिल्लक विवरण. महिन्याची प्रारंभिक/अखेरची शिल्लक रोकड वहीवरून
-- (नमुना ५) काढली जाते, साठवत नाही; फक्त ती शिल्लक कोठे ठेवली आहे याची विभागणी
-- (हातात/बँक/पोस्ट/अल्पबचत/मुदत ठेव) हाताने भरतात आणि एकूण रोकड वहीशी जुळते का
-- ते तपासले जाते.
CREATE TABLE IF NOT EXISTS monthly_balance_statements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  in_hand DECIMAL(14,2) NOT NULL DEFAULT 0,
  in_bank DECIMAL(14,2) NOT NULL DEFAULT 0,
  in_post DECIMAL(14,2) NOT NULL DEFAULT 0,
  savings_certificates DECIMAL(14,2) NOT NULL DEFAULT 0,
  fixed_deposits DECIMAL(14,2) NOT NULL DEFAULT 0,
  remark TEXT NULL,
  UNIQUE KEY uq_balance_statement (financial_year_id, year, month),
  CONSTRAINT fk_balance_stmt_year FOREIGN KEY (financial_year_id) REFERENCES financial_years(id) ON DELETE CASCADE
) ENGINE=InnoDB;
