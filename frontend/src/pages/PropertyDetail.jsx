import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';
import { round2 } from '../utils/taxCalc';
import { fetchGpmasterList } from '../utils/gpmasterCache';
import CloseReportButton from '../components/CloseReportButton';
import VillageMapView from '../components/VillageMapView';

const emptyMaster = {
  property_code: '', srno: '', malmata_no: '', particulars: '', construction_type: '',
  owner_name: '', spouse_name: '', bhogvatdar: '', milkat_year: '', is_government: false, narration: '',
};

const emptyLatLong = () => Array.from({ length: 4 }, () => ({ latitude: '', longitude: '' }));

// मिळकतीचे अक्षांश/रेखांश - ४ कोपऱ्यांचे बिंदू (मालमत्ता क्रमांकावर आधारित, latlong टेबल).
// दशांश (17.91068081) किंवा दिशेसह (17.91068081N) दोन्ही स्वरूपात भरता येते.
function LatLongCard({ malmataNo, points, setPoints, saved, onSave, canEdit, notice, error }) {
  const navigate = useNavigate();
  // नकाशावर सर्व मिळकती दिसाव्यात (सध्याची लाल/ठळक, बाकीच्या निळ्या) - सध्याच्या मिळकतीचे बिंदू ताजे (saved) वापरतो.
  const [allItems, setAllItems] = useState([]);
  useEffect(() => { client.get('/latlong').then(({ data }) => setAllItems(data)).catch(() => {}); }, []);
  const mapItems = useMemo(() => {
    const others = allItems.filter((it) => String(it.malmata_no) !== String(malmataNo));
    const mine = allItems.find((it) => String(it.malmata_no) === String(malmataNo));
    return [...others, { malmata_no: malmataNo, points: saved, property: mine?.property || null }];
  }, [allItems, saved, malmataNo]);
  const openProperty = useCallback((id) => navigate(`/properties/${id}`), [navigate]);
  const setPoint = (i, key, value) => setPoints((ps) => ps.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 14, marginTop: 0 }}>अक्षांश / रेखांश (मिळकतीचे ४ कोपरे){malmataNo ? ` — मालमत्ता क्र. ${malmataNo}` : ''}</h2>
      {!malmataNo && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>अक्षांश/रेखांश मालमत्ता क्रमांकावर जोडले जातात - आधी वर "मालमत्ता क्र." भरा.</p>}
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="notice-box">{notice}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
        {points.map((p, i) => (
          <div key={i} className="field">
            <label>बिंदू {i + 1} — अक्षांश (Latitude) / रेखांश (Longitude)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ flex: 1, minWidth: 0 }} placeholder="17.91068081" value={p.latitude} disabled={!canEdit || !malmataNo} onChange={(e) => setPoint(i, 'latitude', e.target.value)} />
              <input style={{ flex: 1, minWidth: 0 }} placeholder="74.98181051" value={p.longitude} disabled={!canEdit || !malmataNo} onChange={(e) => setPoint(i, 'longitude', e.target.value)} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {onSave && <button className="btn" type="button" onClick={onSave} disabled={!canEdit || !malmataNo}>अक्षांश/रेखांश जतन करा</button>}
        {saved.length > 0 && malmataNo && <Link className="btn secondary" to={`/village-map?malmata=${encodeURIComponent(malmataNo)}`}>गावाच्या नकाशावर पहा</Link>}
      </div>
      {saved.length > 0 && malmataNo && (
        <div style={{ marginTop: 14 }}>
          <VillageMapView items={mapItems} focusMalmata={malmataNo} focusMaxZoom={18} height={380} onOpenProperty={openProperty} />
        </div>
      )}
    </div>
  );
}

const emptyAssessment = {
  new_length: '', new_width: '', area_sqft: '', area_sqm: '',
  jamin_rate_used: '', gasara_rate: '', bharank: '', karacha_rate: '', bhandvalimula_rs: '',
  gharpatti: '', divabatti: '', arogya: '', panipatti: '', gov_status: 0, narration: '', construction_year: '',
};

// मिळकत कोड टाकल्यावर/बाहेर क्लिक केल्यावर मिळकतदार मास्टर (GPMASTER)
// मधून मालकाचे नांव व पत्नीचे नांव आपोआप भरते - प्रत्येक रकाना स्वतंत्रपणे
// "only if empty" (खरा/आधीच भरलेला मजकूर कधीही न बदलणे). मालकाचे नाव
// आधीच भरलेले (उदा. जुनी/अस्तित्वात असलेली नोंद) असले तरी पत्नीचे नाव अजून
// रिकामे असेल तर तेवढेच भरते - म्हणून owner_name भरलेला असला तरीही हे फंक्शन
// पूर्णपणे न थांबता (आधी owner_name भरलेला दिसताच संपूर्ण थांबत असे, त्यामुळे
// जुन्या नोंदींना पत्नीचे नाव कधीच मिळत नसे) पुढे जाऊन spouse_name तपासते.
// GPMASTER मध्ये तो कोड नसेल तर काहीच होत नाही, स्टाफ स्वतः नांव टाइप करतो.
async function fillOwnerFromGpMaster(code, master, setMaster) {
  if (!code || (master.owner_name && master.spouse_name)) return;
  try {
    const { data } = await client.get(`/gpmaster/${code}`);
    setMaster((m) => (m.property_code !== code ? m : {
      ...m,
      owner_name: m.owner_name || data.owner_name,
      spouse_name: m.spouse_name || data.spouse_name || '',
    }));
  } catch {
    // GPMASTER मध्ये हा कोड नोंदलेला नाही - शांतपणे दुर्लक्ष करा.
  }
}

// अ.क्र. (SRNO) आपोआप सुचवते - "only if empty" पद्धतीनेच (fillOwnerFromGpMaster प्रमाणेच),
// त्यामुळे संपादन करतानाचा आधीच भरलेला अ.क्र. कधीही बदलत नाही. हा कोड आधीपासून वापरलेला
// असेल (त्याच मालकाची दुसरी मालमत्ता जोडत आहोत) तर त्याच जुन्या नोंदीचा अ.क्र. येतो;
// कोड सर्वस्वी नवीन असेल तर सध्याच्या सर्वात मोठ्या अ.क्र. च्या पुढचा (+१) येतो.
async function fillSrnoSuggestion(code, master, setMaster) {
  if (!code || master.srno) return;
  try {
    const { data } = await client.get('/properties/next-srno', { params: { propertyCode: code } });
    setMaster((m) => (m.srno || m.property_code !== code ? m : { ...m, srno: String(data.srno) }));
  } catch {
    // अंदाज आणता आला नाही - स्टाफ स्वतः अ.क्र. टाइप करू शकतो.
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
    setMaster({ ...master, property_code: String(g.code), owner_name: g.owner_name, spouse_name: master.spouse_name || g.spouse_name || '' });
    setCodeSearch(String(g.code));
    setCodeDropdownOpen(false);
    fillSrnoSuggestion(String(g.code), master, setMaster);
  }

  function handleCodeChange(value) {
    setCodeSearch(value);
    setCodeDropdownOpen(true);
    if (/^\d*$/.test(value)) setMaster((m) => ({ ...m, property_code: value }));
  }

  return (
    <div className="form-grid">
      <div className="field narrow-field">
        <label>मिळकत कोड</label>
        <div className="combo-wrap">
          <input
            value={codeSearch}
            onChange={(e) => handleCodeChange(e.target.value)}
            onFocus={() => setCodeDropdownOpen(true)}
            onBlur={(e) => {
              // यादीतील नावावर क्लिक केल्यास onMouseDown (selectGpCode) आधीच बंद करतो, ते
              // नेहमी या blur च्या आधी चालते; Tab दाबून किंवा इतरत्र क्लिक करून बाहेर
              // पडल्यासही यादी इथे बंद व्हायला हवी.
              setCodeDropdownOpen(false);
              fillOwnerFromGpMaster(e.target.value, master, setMaster);
              fillSrnoSuggestion(e.target.value, master, setMaster);
            }}
            placeholder="कोड किंवा मालकाचे नाव टाइप करा"
          />
          {codeDropdownOpen && (
            <div className="combo-dropdown">
              {codeResults.length === 0 && (
                <div className="combo-empty">
                  जुळणारी नोंद सापडली नाही.{' '}
                  <a href="/gpmaster" target="_blank" rel="noopener noreferrer">
                    नवीन कोड/नाव GPMASTER मध्ये जोडण्यासाठी इथे क्लिक करा
                  </a>{' '}
                  (नवीन टॅबमध्ये उघडेल, हा फॉर्म तसाच राहील).
                </div>
              )}
              {codeResults.map((g) => (
                <div key={g.code} className="combo-option" onMouseDown={() => selectGpCode(g)}>
                  {g.code} - {g.owner_name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="field wide-field readonly">
        <label>मालकाचे नाव *</label>
        <input required disabled value={master.owner_name} placeholder="मिळकत कोड निवडा - मालकाचे नाव आपोआप येईल" />
      </div>
      <div className="field wide-field readonly">
        <label>पत्नीचे नाव</label>
        <input disabled value={master.spouse_name} placeholder="GPMASTER मध्ये नोंदलेले असल्यास आपोआप येईल" />
      </div>
      <div className="field wide-field" style={{ marginTop: -8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          मालकाचे व पत्नीचे नाव इथे टाइप करता येत नाही - ते मिळकतदार मास्टर (GPMASTER) मधूनच कोडनुसार आपोआप येते.
          नाव चुकीचे/अपुरे असल्यास{' '}
          <a href="/gpmaster" target="_blank" rel="noopener noreferrer">इथे क्लिक करून GPMASTER मध्ये दुरुस्त करा</a>
          {' '}(नवीन टॅबमध्ये उघडेल), मग हे पान रिफ्रेश करा.
        </span>
      </div>
      <div className="field narrow-field">
        <label>अ.क्र. (SRNO)</label>
        <input type="number" value={master.srno} onChange={(e) => setMaster({ ...master, srno: e.target.value })} />
      </div>
      <div className="field narrow-field">
        <label>मालमत्ता क्र.</label>
        <input value={master.malmata_no} onChange={(e) => setMaster({ ...master, malmata_no: e.target.value })} />
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
      <div className="field">
        <label>बांधकाम वर्ष</label>
        <input maxLength={20} placeholder="उदा. 2005, 1990" value={assessmentForm.construction_year ?? ''}
          onChange={(e) => setAssessmentForm({ ...assessmentForm, construction_year: e.target.value })} />
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

  // अक्षांश/रेखांश (latlong) - मालमत्ता क्रमांकानुसार; latlong = भरायचे ४ बिंदू, latlongSaved = जतन केलेले (नकाशासाठी)
  const [latlong, setLatlong] = useState(emptyLatLong());
  const [latlongSaved, setLatlongSaved] = useState([]);
  const [latlongNotice, setLatlongNotice] = useState('');
  const [latlongError, setLatlongError] = useState('');
  const malmataKey = String(master.malmata_no || '').trim();

  useEffect(() => {
    setLatlongNotice('');
    setLatlongError('');
    if (!malmataKey) { setLatlong(emptyLatLong()); setLatlongSaved([]); return undefined; }
    const t = setTimeout(() => {
      client.get(`/latlong/${encodeURIComponent(malmataKey)}`).then(({ data }) => {
        const filled = emptyLatLong();
        data.slice(0, 4).forEach((p, i) => { filled[i] = { latitude: String(p.latitude), longitude: String(p.longitude) }; });
        setLatlong(filled);
        setLatlongSaved(data);
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [malmataKey]);

  async function saveLatlong(key = malmataKey) {
    setLatlongNotice('');
    setLatlongError('');
    try {
      await client.put(`/latlong/${encodeURIComponent(key)}`, { points: latlong });
      const { data } = await client.get(`/latlong/${encodeURIComponent(key)}`);
      setLatlongSaved(data);
      setLatlongNotice('अक्षांश/रेखांश जतन झाले.');
    } catch (err) {
      setLatlongError(err.response?.data?.error || 'अक्षांश/रेखांश जतन करताना त्रुटी आली');
    }
  }

  useEffect(() => {
    client.get('/particulars').then(({ data }) => setParticulars(data));
    fetchGpmasterList().then(setGpmasterList);
  }, []);

  const loadProperty = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const { data } = await client.get(`/properties/${id}`);
      const nextMaster = {
        property_code: data.property_code ?? '', srno: data.srno ?? '', malmata_no: data.malmata_no ?? '',
        particulars: data.particulars ?? '', construction_type: data.construction_type ?? '',
        owner_name: data.owner_name ?? '', spouse_name: data.spouse_name ?? '', bhogvatdar: data.bhogvatdar ?? '', milkat_year: data.milkat_year ?? '',
        is_government: !!data.is_government, narration: data.narration ?? '',
      };
      setMaster(nextMaster);
      setAssessments(data.assessments || []);
      // जुन्या (स्पाउस-नेम फीचर येण्याआधी भरलेल्या) नोंदींसाठी - पत्नीचे नाव
      // अजून रिकामे असेल तर उघडताक्षणीच GPMASTER मधून एकदा भरून बघते (मालकाचे
      // नाव आधीच असले तरी, fillOwnerFromGpMaster चा per-field नियम).
      if (nextMaster.property_code && !nextMaster.spouse_name) {
        fillOwnerFromGpMaster(nextMaster.property_code, nextMaster, setMaster);
      }
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
        construction_year: existing.construction_year ?? '',
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
  // force=false (useEffect कडून, बांधकाम प्रकार निवडल्यावर आपोआप): फक्त
  // रिकाम्या रकान्यांतच मास्टरचा दर भरतो, आधीच भरलेला (जतन केलेला किंवा
  // हाताने बदललेला) आकडा कधीही बदलत नाही.
  // force=true ("दर मास्टरमधून भरा" बटण, स्टाफने स्पष्ट क्लिक केल्यावर): हेतू
  // स्पष्ट आहे - सर्व दर मास्टरप्रमाणे परत भरा, म्हणून आधीचा आकडा काहीही
  // असला तरी मास्टरच्या दराने बदलतो. आधी दोन्ही ठिकाणी "फक्त रिकामे असेल तरच"
  // हाच नियम असल्याने, आधीच भरलेल्या (उदा. अस्तित्वात असलेल्या नोंदीच्या)
  // रकान्यांवर बटण दाबूनही काहीच बदल दिसत नसे - क्लिक "काम करत नाही" असे वाटे.
  function fillDefaultsFromMaster(particular, force = false) {
    if (!particular) return;
    setAssessmentForm((f) => {
      const keep = (current) => !force && Number(current);
      const next = {
        ...f,
        karacha_rate: keep(f.karacha_rate) ? f.karacha_rate : particular.gharpatti_rate,
        jamin_rate_used: keep(f.jamin_rate_used) ? f.jamin_rate_used : particular.jamin_rate,
        divabatti: keep(f.divabatti) ? f.divabatti : particular.divabatti_rate,
        arogya: keep(f.arogya) ? f.arogya : particular.arogya_rate,
        panipatti: keep(f.panipatti) ? f.panipatti : particular.panipatti_rate,
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
      const hasAssessmentData = Boolean(selectedParticular) || Boolean(String(assessmentForm.construction_year ?? '').trim()) || ['new_length', 'new_width', 'gharpatti', 'divabatti', 'arogya', 'panipatti']
        .some((k) => Number(assessmentForm[k]) > 0);
      if (hasAssessmentData && selectedYearId) {
        await client.post('/assessments', { ...assessmentForm, property_id: data.id, financial_year_id: selectedYearId });
      }
      if (malmataKey && latlong.some((p) => String(p.latitude).trim() || String(p.longitude).trim())) {
        try { await client.put(`/latlong/${encodeURIComponent(malmataKey)}`, { points: latlong }); } catch { /* मिळकत जतन झाली; अक्षांश/रेखांश तपशील पानावरून पुन्हा भरता येतील */ }
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
    <div className="page data-entry-page property-detail-page">
      <div className="page-header">
        <h1>{isNew ? 'नवीन मिळकत नोंद' : `मिळकत तपशील — ${master.owner_name || `कोड ${master.property_code || master.srno || propertyId}`}`}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn secondary" onClick={() => navigate(-1)}>यादीकडे परत</button>
          <CloseReportButton />
        </div>
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
              <button className="btn secondary" type="button" onClick={() => fillDefaultsFromMaster(selectedParticular, true)} disabled={!selectedParticular}>
                दर मास्टरमधून भरा
              </button>
            </div>
          </div>

          <LatLongCard malmataNo={malmataKey} points={latlong} setPoints={setLatlong} saved={latlongSaved}
            canEdit={can('properties', 'add')} notice={latlongNotice} error={latlongError} />

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
                <button className="btn secondary" type="button" onClick={() => fillDefaultsFromMaster(selectedParticular, true)} disabled={!selectedParticular}>
                  दर मास्टरमधून भरा
                </button>
                <button className="btn" type="submit" disabled={!can('properties', existingAssessmentId ? 'edit' : 'add')}>{existingAssessmentId ? 'अद्ययावत करा' : 'जतन करा'}</button>
                {existingAssessmentId && <button className="btn danger" type="button" onClick={handleAssessmentDelete} disabled={!can('properties', 'delete')}>या वर्षाचा तपशील मिटवा</button>}
              </div>
            </form>
          </div>

          <LatLongCard malmataNo={malmataKey} points={latlong} setPoints={setLatlong} saved={latlongSaved}
            onSave={() => saveLatlong()} canEdit={can('properties', 'edit')} notice={latlongNotice} error={latlongError} />
        </>
      )}
    </div>
  );
}
