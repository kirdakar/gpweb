import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';
import { round2 } from '../utils/taxCalc';

const emptyMaster = {
  property_code: '', srno: '', malmata_no: '', particulars: '', construction_type: '',
  owner_name: '', bhogvatdar: '', milkat_year: '', is_government: false, narration: '',
};

const emptyAssessment = {
  new_length: '', new_width: '', area_sqft: '', area_sqm: '',
  jamin_rate_used: '', gasara_rate: '', bharank: '', karacha_rate: '', bhandvalimula_rs: '',
  gharpatti: '', divabatti: '', arogya: '', panipatti: '', gov_status: 0, narration: '',
};

// मिळकत कोड टाकल्यावर/बाहेर क्लिक केल्यावर मिळकतदार मास्टर (GPMASTER)
// मधून मालकाचे नांव आपोआप भरते - फक्त मालकाचे नांव अजून रिकामे असेल तरच
// (खरा/आधीच भरलेला वेगळा मालकाचे नाव कधीही न बदलणे, "only if empty" पद्धत).
// GPMASTER मध्ये तो कोड नसेल तर काहीच होत नाही, स्टाफ स्वतः नांव टाइप करतो.
async function fillOwnerFromGpMaster(code, master, setMaster) {
  if (!code || master.owner_name) return;
  try {
    const { data } = await client.get(`/gpmaster/${code}`);
    setMaster((m) => (m.owner_name || m.property_code !== code ? m : { ...m, owner_name: data.owner_name }));
  } catch {
    // GPMASTER मध्ये हा कोड नोंदलेला नाही - शांतपणे दुर्लक्ष करा.
  }
}

// मूळ माहिती (Property Master) चे फील्ड्स - नवीन व अस्तित्वात असलेल्या
// दोन्ही मिळकतींसाठी वापरले जातात (नोंदी वेगळ्या पण फील्ड्स तीच).
function MasterFields({ master, setMaster, particulars, gpmasterList }) {
  // मिळकत कोड आता साधा textbox नसून शोध-कंबो आहे - कोड किंवा मालकाचे नाव
  // टाइप करून GPMASTER मधून निवडता येते (निवडल्यावर कोड + नाव दोन्ही भरते).
  // अजून GPMASTER मध्ये नसलेला नवा कोडही टाइप करता यावा म्हणून शुद्ध आकडा
  // टाइप करताच तो थेट property_code म्हणून घेतला जातो (इतर combo सारखेच
  // pattern - onMouseDown वापरून निवड, dropdown फक्त निवड/शोध-क्लिअरने बंद होतो).
  const [codeSearch, setCodeSearch] = useState(master.property_code ? String(master.property_code) : '');
  const [codeDropdownOpen, setCodeDropdownOpen] = useState(false);

  useEffect(() => {
    if (!codeDropdownOpen && !codeSearch && master.property_code) {
      setCodeSearch(String(master.property_code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [master.property_code]);

  const codeSearchTerm = codeSearch.trim().toLowerCase();
  const codeResults = useMemo(() => {
    if (!codeSearchTerm) return gpmasterList.slice(0, 50);
    return gpmasterList.filter((g) =>
      String(g.code).includes(codeSearchTerm) || (g.owner_name || '').toLowerCase().includes(codeSearchTerm)
    ).slice(0, 50);
  }, [gpmasterList, codeSearchTerm]);

  function selectGpCode(g) {
    setMaster({ ...master, property_code: String(g.code), owner_name: g.owner_name });
    setCodeSearch(String(g.code));
    setCodeDropdownOpen(false);
  }

  function handleCodeChange(value) {
    setCodeSearch(value);
    setCodeDropdownOpen(true);
    if (/^\d*$/.test(value)) setMaster((m) => ({ ...m, property_code: value }));
  }

  return (
    <div className="form-grid">
      <div className="field">
        <label>मिळकत कोड</label>
        <div className="combo-wrap">
          <input
            value={codeSearch}
            onChange={(e) => handleCodeChange(e.target.value)}
            onFocus={() => setCodeDropdownOpen(true)}
            onBlur={(e) => fillOwnerFromGpMaster(e.target.value, master, setMaster)}
            placeholder="कोड किंवा मालकाचे नाव टाइप करा"
          />
          {codeDropdownOpen && (
            <div className="combo-dropdown">
              {codeResults.length === 0 && <div className="combo-empty">जुळणारी नोंद सापडली नाही</div>}
              {codeResults.map((g) => (
                <div key={g.code} className="combo-option" onMouseDown={() => selectGpCode(g)}>
                  {g.code} - {g.owner_name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="field">
        <label>अ.क्र. (SRNO)</label>
        <input type="number" value={master.srno} onChange={(e) => setMaster({ ...master, srno: e.target.value })} />
      </div>
      <div className="field">
        <label>मालमत्ता क्र.</label>
        <input value={master.malmata_no} onChange={(e) => setMaster({ ...master, malmata_no: e.target.value })} />
      </div>
      <div className="field">
        <label>मालकाचे नाव *</label>
        <input required value={master.owner_name} onChange={(e) => setMaster({ ...master, owner_name: e.target.value })} />
      </div>
      <div className="field">
        <label>भोगवटादार</label>
        <input value={master.bhogvatdar} onChange={(e) => setMaster({ ...master, bhogvatdar: e.target.value })} />
      </div>
      <div className="field">
        <label>बांधकाम प्रकार</label>
        <select value={master.construction_type} onChange={(e) => setMaster({ ...master, construction_type: e.target.value })}>
          <option value="">-- निवडा --</option>
          {particulars.map((p) => <option key={p.par_code} value={p.par_code}>{p.par_name || `कोड ${p.par_code}`}</option>)}
        </select>
      </div>
      <div className="field">
        <label>तपशील (Particulars)</label>
        <input value={master.particulars} onChange={(e) => setMaster({ ...master, particulars: e.target.value })} />
      </div>
      <div className="field">
        <label>मिळकत वर्ष (जुना संदर्भ)</label>
        <input value={master.milkat_year} onChange={(e) => setMaster({ ...master, milkat_year: e.target.value })} />
      </div>
      <div className="field">
        <label>&nbsp;</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
          <input type="checkbox" checked={master.is_government} onChange={(e) => setMaster({ ...master, is_government: e.target.checked })} />
          शासकीय मिळकत आहे
        </label>
      </div>
    </div>
  );
}

// वर्षनिहाय कर तपशील (Year-wise Tax Assessment) चे फील्ड्स - नवीन व
// अस्तित्वात असलेल्या दोन्ही मिळकतींसाठी वापरले जातात.
function AssessmentFields({ assessmentForm, setAssessmentForm, updateAssessment, suggestedGharpatti, totalTax }) {
  return (
    <div className="form-grid">
      <div className="field">
        <label>लांबी (NEWL)</label>
        <input type="number" step="0.01" value={assessmentForm.new_length} onChange={(e) => updateAssessment({ new_length: e.target.value })} />
      </div>
      <div className="field">
        <label>रुंदी (NEWW)</label>
        <input type="number" step="0.01" value={assessmentForm.new_width} onChange={(e) => updateAssessment({ new_width: e.target.value })} />
      </div>
      <div className="field">
        <label>क्षेत्रफळ चौ.फूट (आपोआप, बदलता येते)</label>
        <input type="number" step="0.01" value={assessmentForm.area_sqft} onChange={(e) => updateAssessment({ area_sqft: e.target.value })} />
      </div>
      <div className="field">
        <label>क्षेत्रफळ चौ.मी. (आपोआप, बदलता येते)</label>
        <input type="number" step="0.01" value={assessmentForm.area_sqm} onChange={(e) => updateAssessment({ area_sqm: e.target.value })} />
      </div>
      <div className="field">
        <label>जमीन दर (RJAMIN)</label>
        <input type="number" step="0.01" value={assessmentForm.jamin_rate_used} onChange={(e) => updateAssessment({ jamin_rate_used: e.target.value })} />
      </div>
      <div className="field">
        <label>गसारा दर</label>
        <input type="number" step="0.01" value={assessmentForm.gasara_rate} onChange={(e) => updateAssessment({ gasara_rate: e.target.value })} />
      </div>
      <div className="field">
        <label>भारांक (Bharank)</label>
        <input type="number" step="0.01" value={assessmentForm.bharank} onChange={(e) => updateAssessment({ bharank: e.target.value })} />
      </div>
      <div className="field">
        <label>कराचा दर (Karacha Rate)</label>
        <input type="number" step="0.001" value={assessmentForm.karacha_rate} onChange={(e) => setAssessmentForm({ ...assessmentForm, karacha_rate: e.target.value })} />
      </div>
      <div className="field">
        <label>भांडवली मूल्य रु. (आपोआप, बदलता येते)</label>
        <input type="number" step="0.01" value={assessmentForm.bhandvalimula_rs} onChange={(e) => setAssessmentForm({ ...assessmentForm, bhandvalimula_rs: e.target.value })} />
      </div>
      <div className="field">
        <label>
          घरपट्टी
          {suggestedGharpatti > 0 && (
            <>
              {' '}<button type="button" className="btn secondary small" style={{ padding: '1px 6px', fontSize: 11 }}
                onClick={() => setAssessmentForm((f) => ({ ...f, gharpatti: suggestedGharpatti }))}>
                सुचवलेले {suggestedGharpatti.toFixed(2)} वापरा
              </button>
            </>
          )}
        </label>
        <input type="number" step="0.01" value={assessmentForm.gharpatti} onChange={(e) => setAssessmentForm({ ...assessmentForm, gharpatti: e.target.value })} />
      </div>
      <div className="field">
        <label>दिवाबत्ती</label>
        <input type="number" step="0.01" value={assessmentForm.divabatti} onChange={(e) => setAssessmentForm({ ...assessmentForm, divabatti: e.target.value })} />
      </div>
      <div className="field">
        <label>आरोग्य कर</label>
        <input type="number" step="0.01" value={assessmentForm.arogya} onChange={(e) => setAssessmentForm({ ...assessmentForm, arogya: e.target.value })} />
      </div>
      <div className="field">
        <label>पाणीपट्टी</label>
        <input type="number" step="0.01" value={assessmentForm.panipatti} onChange={(e) => setAssessmentForm({ ...assessmentForm, panipatti: e.target.value })} />
      </div>
      <div className="field readonly">
        <label>एकूण कर (स्वयं)</label>
        <input readOnly value={totalTax.toFixed(2)} />
      </div>
      <div className="field">
        <label>शासकीय स्थिती</label>
        <select value={assessmentForm.gov_status} onChange={(e) => setAssessmentForm({ ...assessmentForm, gov_status: Number(e.target.value) })}>
          <option value={0}>-- निवडलेले नाही --</option>
          <option value={1}>1 - आहे</option>
          <option value={2}>2 - नाही</option>
        </select>
      </div>
    </div>
  );
}

export default function PropertyDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { years, yearId: globalYearId } = useYear();
  const { can } = usePermissions();

  const [particulars, setParticulars] = useState([]);
  const [gpmasterList, setGpmasterList] = useState([]);
  const [master, setMaster] = useState(emptyMaster);
  const propertyId = isNew ? null : Number(id);
  const [assessments, setAssessments] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState(globalYearId);
  const [assessmentForm, setAssessmentForm] = useState(emptyAssessment);
  const [existingAssessmentId, setExistingAssessmentId] = useState(null);

  const [masterError, setMasterError] = useState('');
  const [masterNotice, setMasterNotice] = useState('');
  const [assessmentError, setAssessmentError] = useState('');
  const [assessmentNotice, setAssessmentNotice] = useState('');
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    client.get('/particulars').then(({ data }) => setParticulars(data));
    client.get('/gpmaster').then(({ data }) => setGpmasterList(data));
  }, []);

  const loadProperty = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const { data } = await client.get(`/properties/${id}`);
      setMaster({
        property_code: data.property_code ?? '', srno: data.srno ?? '', malmata_no: data.malmata_no ?? '',
        particulars: data.particulars ?? '', construction_type: data.construction_type ?? '',
        owner_name: data.owner_name ?? '', bhogvatdar: data.bhogvatdar ?? '', milkat_year: data.milkat_year ?? '',
        is_government: !!data.is_government, narration: data.narration ?? '',
      });
      setAssessments(data.assessments || []);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { loadProperty(); }, [loadProperty]);

  useEffect(() => {
    if (!selectedYearId && globalYearId) setSelectedYearId(globalYearId);
  }, [globalYearId, selectedYearId]);

  useEffect(() => {
    if (isNew) return; // नवीन मिळकतीसाठी हा गार्ड लागत नाही - खाली वेगळा भरणा प्रवाह आहे.
    const existing = assessments.find((a) => a.financial_year_id === selectedYearId);
    if (existing) {
      setExistingAssessmentId(existing.id);
      setAssessmentForm({
        new_length: existing.new_length, new_width: existing.new_width,
        area_sqft: existing.area_sqft, area_sqm: existing.area_sqm,
        jamin_rate_used: existing.jamin_rate_used, gasara_rate: existing.gasara_rate,
        bharank: existing.bharank, karacha_rate: existing.karacha_rate,
        bhandvalimula_rs: existing.bhandvalimula_rs,
        gharpatti: existing.gharpatti,
        divabatti: existing.divabatti, arogya: existing.arogya, panipatti: existing.panipatti,
        gov_status: existing.gov_status, narration: existing.narration ?? '',
      });
    } else {
      setExistingAssessmentId(null);
      setAssessmentForm(emptyAssessment);
    }
    setAssessmentError('');
    setAssessmentNotice('');
  }, [isNew, selectedYearId, assessments]);

  const selectedParticular = particulars.find((p) => p.par_code === Number(master.construction_type));

  // Form3.vb's CalculateValues() auto-filled क्षेत्रफळ/भांडवली मूल्य on every
  // NEWL/NEWW/RJAMIN/गसारा/भारांक change, but only TxtTOTAL was hard-locked
  // read-only - these stayed plain, directly-editable textboxes, so a clerk
  // could type over the auto-computed value (correction, or legacy rows with
  // no L x W breakdown). This mirrors that: changing an upstream field
  // recomputes the downstream ones, but every field here stays editable.
  function updateAssessment(patch) {
    setAssessmentForm((f) => {
      const next = { ...f, ...patch };
      if ('new_length' in patch || 'new_width' in patch) {
        const L = Number(next.new_length) || 0;
        const W = Number(next.new_width) || 0;
        next.area_sqft = round2(L * W);
        next.area_sqm = round2(next.area_sqft / 10.76);
      }
      if ('new_length' in patch || 'new_width' in patch || 'area_sqm' in patch
        || 'jamin_rate_used' in patch || 'gasara_rate' in patch || 'bharank' in patch) {
        const sqm = Number(next.area_sqm) || 0;
        const jamin = Number(next.jamin_rate_used) || 0;
        const gasara = Number(next.gasara_rate) || 0;
        const bharank = Number(next.bharank) || 0;
        next.bhandvalimula_rs = round2(sqm * jamin * gasara * bharank);
      }
      return next;
    });
  }

  const totalTax = round2(
    (Number(assessmentForm.gharpatti) || 0) + (Number(assessmentForm.divabatti) || 0)
    + (Number(assessmentForm.arogya) || 0) + (Number(assessmentForm.panipatti) || 0)
  );
  const suggestedGharpatti = round2(
    ((Number(assessmentForm.bhandvalimula_rs) || 0) * (Number(assessmentForm.karacha_rate) || 0)) / 1000
  );

  // Form3.vb's ComboBox_SelectedIndexChanged auto-filled these rate fields
  // the instant बांधकाम प्रकार was picked - no separate button. Mirrored via
  // the effect below (keyed on the selected particular, not on year/form
  // state, so switching years or reloading an already-filled record never
  // clobbers real saved figures - it only fills currently-empty fields).
  function fillDefaultsFromMaster(particular) {
    if (!particular) return;
    setAssessmentForm((f) => {
      const next = {
        ...f,
        karacha_rate: Number(f.karacha_rate) ? f.karacha_rate : particular.gharpatti_rate,
        jamin_rate_used: Number(f.jamin_rate_used) ? f.jamin_rate_used : particular.jamin_rate,
        divabatti: Number(f.divabatti) ? f.divabatti : particular.divabatti_rate,
        arogya: Number(f.arogya) ? f.arogya : particular.arogya_rate,
        panipatti: Number(f.panipatti) ? f.panipatti : particular.panipatti_rate,
      };
      const sqm = Number(next.area_sqm) || 0;
      const jamin = Number(next.jamin_rate_used) || 0;
      const gasara = Number(next.gasara_rate) || 0;
      const bharank = Number(next.bharank) || 0;
      next.bhandvalimula_rs = round2(sqm * jamin * gasara * bharank);
      return next;
    });
  }

  useEffect(() => {
    if (selectedParticular) fillDefaultsFromMaster(selectedParticular);
    // Re-runs whenever: (a) बांधकाम प्रकार is picked/changed, (b) the year
    // switches to one with no saved assessment yet, or (c) a brand-new
    // property just got saved and this page reloaded for it (assessments
    // resets to []) - in every case the form is freshly empty and should
    // get the master's defaults, exactly like (b)/(c) would otherwise leave
    // it blank until someone remembers to press "दर मास्टरमधून भरा".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParticular?.par_code, selectedYearId, assessments]);

  async function handleMasterSubmit(e) {
    e.preventDefault();
    setMasterError('');
    setMasterNotice('');
    const payload = {
      ...master,
      property_code: master.property_code === '' ? null : Number(master.property_code),
      srno: master.srno === '' ? null : Number(master.srno),
      construction_type: master.construction_type === '' ? null : Number(master.construction_type),
    };
    try {
      await client.put(`/properties/${propertyId}`, payload);
      setMasterNotice('मिळकत माहिती अद्ययावत झाली.');
    } catch (err) {
      setMasterError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    }
  }

  // नवीन मिळकत नोंद: मूळ माहिती + वर्षनिहाय कर तपशील (बांधकाम प्रकार, लांबी,
  // रुंदी, कर इ.) हे सर्व एकाच वेळी, एका बटणाने जतन होते - आधी मिळकत तयार
  // करून मगच कर तपशील दिसण्याची दोन-टप्प्यांची गरज उरत नाही. (यादीतील
  // अस्तित्वात असलेली मिळकत उघडल्यावरचा प्रवाह वेगळाच व आहे तसाच ठेवला आहे.)
  async function handleNewPropertySubmit(e) {
    e.preventDefault();
    setMasterError('');
    setMasterNotice('');
    const payload = {
      ...master,
      property_code: master.property_code === '' ? null : Number(master.property_code),
      srno: master.srno === '' ? null : Number(master.srno),
      construction_type: master.construction_type === '' ? null : Number(master.construction_type),
    };
    try {
      const { data } = await client.post('/properties', payload);
      const hasAssessmentData = Boolean(selectedParticular) || ['new_length', 'new_width', 'gharpatti', 'divabatti', 'arogya', 'panipatti']
        .some((k) => Number(assessmentForm[k]) > 0);
      if (hasAssessmentData && selectedYearId) {
        await client.post('/assessments', { ...assessmentForm, property_id: data.id, financial_year_id: selectedYearId });
      }
      navigate(`/properties/${data.id}`, { replace: true });
    } catch (err) {
      setMasterError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    }
  }

  async function handleAssessmentSubmit(e) {
    e.preventDefault();
    setAssessmentError('');
    setAssessmentNotice('');
    const payload = { ...assessmentForm, property_id: propertyId, financial_year_id: selectedYearId };
    try {
      if (existingAssessmentId) {
        await client.put(`/assessments/${existingAssessmentId}`, payload);
        setAssessmentNotice('कर तपशील अद्ययावत झाला.');
      } else {
        await client.post('/assessments', payload);
        setAssessmentNotice('कर तपशील जतन झाला.');
      }
      loadProperty();
    } catch (err) {
      setAssessmentError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    }
  }

  async function handleAssessmentDelete() {
    if (!existingAssessmentId) return;
    if (!window.confirm('या वर्षाचा कर तपशील मिटवायचा आहे का?')) return;
    await client.delete(`/assessments/${existingAssessmentId}`);
    loadProperty();
  }

  async function handleDeleteProperty() {
    if (!window.confirm('ही संपूर्ण मिळकत नोंद (सर्व वर्षांच्या कर तपशीलासह) मिटवायची आहे का?')) return;
    await client.delete(`/properties/${propertyId}`);
    navigate('/properties');
  }

  if (loading) return <div className="page"><p>लोड होत आहे...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isNew ? 'नवीन मिळकत नोंद' : `मिळकत तपशील — ${master.owner_name || `कोड ${master.property_code || master.srno || propertyId}`}`}</h1>
        <Link className="btn secondary" to="/properties">यादीकडे परत</Link>
      </div>

      {isNew ? (
        <form onSubmit={handleNewPropertySubmit}>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, marginTop: 0 }}>मूळ माहिती (Property Master)</h2>
            {masterError && <div className="error-box">{masterError}</div>}
            {masterNotice && <div className="notice-box">{masterNotice}</div>}
            <MasterFields master={master} setMaster={setMaster} particulars={particulars} gpmasterList={gpmasterList} />
            <div className="field" style={{ marginTop: 14 }}>
              <label>शेरा</label>
              <textarea rows={2} value={master.narration} onChange={(e) => setMaster({ ...master, narration: e.target.value })} />
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>वर्षनिहाय कर तपशील (Year-wise Tax Assessment)</h2>
              <select value={selectedYearId || ''} onChange={(e) => setSelectedYearId(Number(e.target.value))}>
                {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
              </select>
            </div>
            <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 12 }}>
              बांधकाम प्रकार निवडल्यावर संबंधित दर आपोआप भरले जातात - गरज वाटल्यास बदलता येतात.
            </p>
            <AssessmentFields
              assessmentForm={assessmentForm} setAssessmentForm={setAssessmentForm}
              updateAssessment={updateAssessment} suggestedGharpatti={suggestedGharpatti} totalTax={totalTax}
            />
            <div className="field" style={{ marginTop: 14 }}>
              <label>शेरा</label>
              <textarea rows={2} value={assessmentForm.narration} onChange={(e) => setAssessmentForm({ ...assessmentForm, narration: e.target.value })} />
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn secondary" type="button" onClick={() => fillDefaultsFromMaster(selectedParticular)} disabled={!selectedParticular}>
                दर मास्टरमधून भरा
              </button>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button className="btn" type="submit" disabled={!can('properties', 'add')}>मिळकत व कर तपशील जतन करा</button>
          </div>
        </form>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, marginTop: 0 }}>मूळ माहिती (Property Master)</h2>
            {masterError && <div className="error-box">{masterError}</div>}
            {masterNotice && <div className="notice-box">{masterNotice}</div>}
            <form onSubmit={handleMasterSubmit}>
              <MasterFields master={master} setMaster={setMaster} particulars={particulars} gpmasterList={gpmasterList} />
              <div className="field" style={{ marginTop: 14 }}>
                <label>शेरा</label>
                <textarea rows={2} value={master.narration} onChange={(e) => setMaster({ ...master, narration: e.target.value })} />
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button className="btn" type="submit" disabled={!can('properties', 'edit')}>मूळ माहिती अद्ययावत करा</button>
                <button className="btn danger" type="button" onClick={handleDeleteProperty} disabled={!can('properties', 'delete')}>मिळकत मिटवा</button>
              </div>
            </form>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>वर्षनिहाय कर तपशील (Year-wise Tax Assessment)</h2>
              <select value={selectedYearId || ''} onChange={(e) => setSelectedYearId(Number(e.target.value))}>
                {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
              </select>
            </div>

            {assessmentError && <div className="error-box">{assessmentError}</div>}
            {assessmentNotice && <div className="notice-box">{assessmentNotice}</div>}

            <form onSubmit={handleAssessmentSubmit}>
              <AssessmentFields
                assessmentForm={assessmentForm} setAssessmentForm={setAssessmentForm}
                updateAssessment={updateAssessment} suggestedGharpatti={suggestedGharpatti} totalTax={totalTax}
              />
              <div className="field" style={{ marginTop: 14 }}>
                <label>शेरा</label>
                <textarea rows={2} value={assessmentForm.narration} onChange={(e) => setAssessmentForm({ ...assessmentForm, narration: e.target.value })} />
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button className="btn secondary" type="button" onClick={() => fillDefaultsFromMaster(selectedParticular)} disabled={!selectedParticular}>
                  दर मास्टरमधून भरा
                </button>
                <button className="btn" type="submit" disabled={!can('properties', existingAssessmentId ? 'edit' : 'add')}>{existingAssessmentId ? 'अद्ययावत करा' : 'जतन करा'}</button>
                {existingAssessmentId && <button className="btn danger" type="button" onClick={handleAssessmentDelete} disabled={!can('properties', 'delete')}>या वर्षाचा तपशील मिटवा</button>}
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
