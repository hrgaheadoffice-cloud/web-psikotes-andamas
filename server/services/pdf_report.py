# server/services/pdf_report.py
from datetime import datetime
from typing import Dict, List, Optional
# try:
#     from weasyprint import HTML
#     HAS_WEASYPRINT = True
# except Exception as e:
#     print(f"Warning: WeasyPrint could not be loaded ({e}). PDF exports will be disabled.")
#     HAS_WEASYPRINT = False
from models import User, Result  # assuming these are accessible


def id_datefmt(dt: datetime) -> str:
    days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ]
    return f"{days[dt.weekday()]}, {dt.day} {months[dt.month - 1]} {dt.year}"


def get_max_score(test_code: str) -> Optional[int]:
    mapping = {
        "DISC": 24,
        "SPEED": 100,
        "MEM": 100,
        "LOGIC": 100,  # 50 questions × 2 points each
        "TEMP": None,
        "LEAD": None
    }
    return mapping.get(test_code)


def get_rating(score: int, max_score: Optional[int], test_name: str) -> Dict[str, str]:
    if max_score is None or score is None:
        return {"label": "-", "class": "neutral", "desc": ""}
    pct = (score / max_score) * 100

    if test_name in ["Memory Test", "IQ Test", "Speed Test", "Logic & Arithmetic Test"]:
        if pct >= 80:
            return {
                "label": "Sangat Baik",
                "class": "excellent",
                "desc": "Performansi sangat tinggi – di atas standar."
            }
        if pct >= 60:
            return {
                "label": "Baik",
                "class": "good",
                "desc": "Performansi baik – memenuhi standar yang diharapkan."
            }
        if pct >= 40:
            return {
                "label": "Cukup",
                "class": "fair",
                "desc": "Performansi cukup – perlu pengembangan lebih lanjut."
            }
        return {
            "label": "Kurang",
            "class": "poor",
            "desc": "Performansi di bawah standar – memerlukan perhatian khusus."
        }
    return {"label": "-", "class": "neutral", "desc": ""}


def generate_participant_pdf(user: User, results: List[Result]) -> bytes:
    if not HAS_WEASYPRINT:
        raise RuntimeError("PDF generation is currently unavailable on this server due to missing system libraries.")
    # Sort results in desired order
    test_order = {
        "DISC": 1,
        "TEMP": 2,
        "LEAD": 3,
        "MEM": 4,
        "LOGIC": 5,
        "IQ": 6,
        "SPEED": 7
    }
    sorted_results = sorted(
        results,
        key=lambda r: test_order.get(r.test.code, 999)
    )

    # Compute overall test date (earliest completion)
    test_dates = [r.completed_at for r in results if r.completed_at]
    overall_test_date = min(test_dates) if test_dates else datetime.now()

    report_date = datetime.now()
    report_id = f"RPT-{user.id}-{report_date.strftime('%Y%m%d%H%M')}"

    # Build HTML content
    html_content = f"""
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Psikotes – {user.full_name or user.username}</title>
<style>
    :root {{
        --primary:   #1e3a8a;
        --secondary: #3b82f6;
        --accent:    #64748b;
        --bg:        #ffffff;
        --paper:     #f8fafc;
        --text:      #1f2937;
        --border:    #e2e8f0;
        --shadow:    0px 1px 3px rgba(15,23,42,0.08);
        --excellent: #10b981;
        --good:      #3b82f6;
        --fair:      #f59e0b;
        --poor:      #ef4444;
        --neutral:   #94a3b8;
    }}
    @page {{
        size: A4;
        margin: 2cm;
        @top-center {{
            content: "LAPORAN PSIKOTES – {user.full_name or user.username}";
            font-size: 9pt;
            color: var(--accent);
            border-bottom: 1px solid var(--border);
            padding-bottom: 4px;
        }}
        @bottom-center {{
            content: "Halaman " counter(page) " dari " counter(pages);
            font-size: 9pt;
            color: var(--accent);
        }}
    }}
    body {{
        font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.5;
        color: var(--text);
        background: var(--bg);
        margin: 0;
        padding: 0;
    }}
    .report-header {{
        text-align: center;
        margin-bottom: 1.5rem;
        padding-bottom: 0.75rem;
        border-bottom: 2px solid var(--primary);
    }}
    .report-header h1 {{
        font-size: 18pt;
        font-weight: 700;
        color: var(--primary);
        margin: 0 0 0.2rem 0;
        letter-spacing: -0.02em;
    }}
    .report-header .subtitle {{
        font-size: 9.5pt;
        color: var(--accent);
        margin: 0;
        font-weight: 500;
    }}
    .profile-card {{
        background: var(--paper);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 1rem 1.25rem;
        margin-bottom: 1.25rem;
        box-shadow: var(--shadow);
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
    }}
    .profile-item {{
        display: flex;
        flex-direction: column;
    }}
    .profile-label {{
        font-size: 8pt;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--accent);
        margin-bottom: 0.2rem;
        font-weight: 600;
    }}
    .profile-value {{
        font-size: 10.5pt;
        font-weight: 700;
        color: var(--text);
    }}
    .test-card {{
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 1rem 1.25rem;
        margin-bottom: 1.25rem;
        box-shadow: var(--shadow);
        page-break-inside: avoid;
    }}
    .test-head {{
        border-bottom: 2px solid var(--secondary);
        padding-bottom: 0.4rem;
        margin-bottom: 0.8rem;
    }}
    .test-title {{
        font-size: 12pt;
        font-weight: 700;
        color: var(--primary);
        margin: 0;
    }}
    .narrative {{
        font-size: 10.2pt;
        text-align: justify;
        margin-bottom: 0.8rem;
        color: #334155;
    }}
    .conclusion-box {{
        background: #f0f9ff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        padding: 0.8rem;
        margin-top: 0.8rem;
        font-size: 10pt;
        color: #1e40af;
        line-height: 1.6;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
        font-size: 10pt;
        margin: 0.8rem 0;
        background: var(--bg);
    }}
    th {{
        background: var(--primary);
        color: #fff;
        font-weight: 600;
        padding: 0.4rem 0.6rem;
        text-align: left;
        border: 1px solid var(--primary);
    }}
    td {{
        padding: 0.4rem 0.6rem;
        border: 1px solid var(--border);
    }}
    tr:nth-child(even) {{
        background: var(--paper);
    }}
    tr.primary-row {{
        background: #eff6ff !important;
        font-weight: 700;
        color: var(--primary);
    }}
    tr.primary-row td:first-child {{
        border-left: 3px solid var(--secondary);
    }}
    .conclusion-cell {{
        background: #f0f9ff;
        font-style: italic;
        color: #1e40af;
        padding: 0.6rem;
        vertical-align: middle;
    }}
    .score-row {{
        display: flex;
        align-items: center;
        margin-bottom: 0.4rem;
        font-size: 10pt;
    }}
    .score-label {{
        flex: 0 0 120px;
        font-weight: 600;
        color: var(--text);
    }}
    .score-bar-wrap {{
        flex: 1;
        height: 8px;
        background: var(--border);
        border-radius: 4px;
        overflow: hidden;
        margin: 0 0.5rem;
    }}
    .score-bar {{
        height: 100%;
        background: var(--secondary);
    }}
    .score-value {{
        flex: 0 0 50px;
        text-align: right;
        font-weight: 700;
        color: var(--primary);
    }}
    .rating-badge {{
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 8.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-left: 0.3rem;
    }}
    .rating-excellent {{ background: #d1fae5; color: #065f46; }}
    .rating-good      {{ background: #dbeafe; color: #1e40af; }}
    .rating-fair      {{ background: #fef3c7; color: #92400e; }}
    .rating-poor      {{ background: #fee2e2; color: #991b1b; }}
    .rating-neutral   {{ background: #f1f5f9; color: #475569; }}
    .report-footer {{
        margin-top: 2rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border);
        font-size: 8.5pt;
        color: var(--accent);
        text-align: center;
        font-weight: 500;
    }}
</style>
</head>
<body>

<div class="report-header">
    <h1>LAPORAN HASIL PSIKOTES</h1>
    <div class="subtitle">Psychological Assessment Report – Andamas Standard</div>
</div>

<!-- PARTICIPANT PROFILE -->
<div class="profile-card">
    <div class="profile-item">
        <span class="profile-label">Nama Lengkap</span>
        <span class="profile-value">{user.full_name or '-'}</span>
    </div>
    <div class="profile-item">
        <span class="profile-label">Pendidikan</span>
        <span class="profile-value">{user.education or '-'}</span>
    </div>
    <div class="profile-item">
        <span class="profile-label">Usia</span>
        <span class="profile-value">{user.age or '-'} Tahun</span>
    </div>
    <div class="profile-item">
        <span class="profile-label">Departemen</span>
        <span class="profile-value">{user.department or '-'}</span>
    </div>
    <div class="profile-item">
        <span class="profile-label">Posisi</span>
        <span class="profile-value">{user.position or '-'}</span>
    </div>
    <div class="profile-item">
        <span class="profile-label">Tanggal Tes</span>
        <span class="profile-value">{id_datefmt(overall_test_date)}</span>
    </div>
</div>

<!-- TEST RESULTS -->
"""

    for r in sorted_results:
        test_code = r.test.code
        test_name = r.test.name
        details = r.details or {}

        html_content += f"""
<div class="test-card">
    <div class="test-head">
        <h2 class="test-title">{test_name}</h2>
    </div>
"""

        # ------------------------------ DISC ------------------------------
        if test_code == "DISC" and details:
            traits = ['D', 'I', 'S', 'C']
            graph_ii = details.get('graph_ii', {})
            graph_i = details.get('graph_i', {})
            graph_iii = details.get('graph_iii', {})
            percentages = details.get('percentages', {})
            stress_gap = details.get('stress_gap', 0)

            # Find primary natural trait (True Self) and primary under pressure
            nat_primary = max(traits, key=lambda t: graph_ii.get(t, 0))
            pre_primary = max(traits, key=lambda t: graph_i.get(t, 0))
            integrated_primary = max(traits, key=lambda t: graph_iii.get(t, 0))

            trait_names = {
                'D': 'Dominance',
                'I': 'Influence',
                'S': 'Steadiness',
                'C': 'Conscientiousness'
            }

            # Descriptions for each trait (natural)
            natural_desc = {
                'D': "tegas, berorientasi hasil, dan suka tantangan.",
                'I': "ramah, optimis, dan mudah bergaul.",
                'S': "sabar, konsisten, dan setia. Mereka menghargai kestabilan serta lebih suka bekerja dalam lingkungan yang harmonis dan minim konflik.",
                'C': "teliti, analitis, dan cermat. Mereka mengikuti prosedur dengan disiplin dan memperhatikan detail."
            }

            # Descriptions for under pressure
            pressure_desc = {
                'D': "lebih keras, tidak sabar, bahkan mendominasi. Mereka ingin segera menyelesaikan masalah dengan cepat, meskipun kadang mengabaikan detail atau perasaan orang lain",
                'I': "lebih ekspresif dan emosional, namun bisa kehilangan fokus dan menjadi kurang teratur",
                'S': "menjadi lebih lambat dalam mengambil keputusan dan cenderung menghindari konflik",
                'C': "menjadi lebih kritis, perfeksionis, dan cenderung menarik diri"
            }

            # Suitability based on stress gap
            if stress_gap < 5:
                suitability = "Sesuai dengan Norm Standard Andamas – memenuhi persyaratan level posisi saat ini."
            elif stress_gap < 10:
                suitability = "Cukup Sesuai dengan Norm Standard Andamas – memenuhi persyaratan, namun memerlukan pengembangan di area tekanan."
            else:
                suitability = "Profil menunjukkan perbedaan signifikan antara diri alami dan penampilan publik – disarankan konseling atau penyesuaian peran."

            # Build main narrative
            narrative = (
                f"Berdasarkan hasil tes DISC, testee menunjukkan perilaku utama alami yang dominan {trait_names[nat_primary]} ({nat_primary}). "
                f"Artinya testee cenderung {natural_desc[nat_primary]} "
                f"Saat di bawah tekanan, testee cenderung {pressure_desc[pre_primary]}. "
                f"Profil kepribadian testee {suitability}"
            )

            html_content += f'<div class="narrative">{narrative}</div>'

            # Build detailed interpretation for each graph as one continuous paragraph
            # Graph I interpretation (Most - Public Self under pressure)
            graph_i_interpretation = (
                f"Grafik I menunjukkan perilaku testee saat menghadapi tekanan atau tuntutan eksternal, di mana testee menampilkan dominan {trait_names[pre_primary]} ({pre_primary}) dengan kecenderungan {pressure_desc[pre_primary]}"
            )

            # Graph II interpretation (Least - Natural Self)
            graph_ii_interpretation = (
                f"Grafik II menggambarkan kecenderungan alami testee – sisi autentik yang muncul saat merasa nyaman dan tidak tertekan – dengan dominan {trait_names[nat_primary]} ({nat_primary}), di mana testee cenderung {natural_desc[nat_primary]}"
            )

            # Graph III interpretation (Integrated - Overall Profile)
            graph_iii_interpretation = (
                f"Grafik III merupakan profil kepribadian terintegrasi yang mencerminkan keseimbangan antara tuntutan lingkungan dan kecenderungan alami, dengan dominan {trait_names[integrated_primary]} ({integrated_primary})"
            )

            # Stress gap interpretation
            if stress_gap < 5:
                stress_interpretation = "Selisih yang kecil antara Grafik I dan II menunjukkan bahwa testee memiliki kestabilan emosi yang baik, mampu beradaptasi dengan tuntutan lingkungan tanpa mengalami tekanan psikologis yang signifikan, serta terdapat konsistensi yang tinggi antara diri alami dan cara testee merespons lingkungan."
            elif stress_gap < 10:
                stress_interpretation = "Selisih moderat menunjukkan bahwa testee sedang dalam proses adaptasi terhadap tuntutan lingkungan; testee mampu menyesuaikan diri namun memerlukan usaha sadar untuk mempertahankan keseimbangan, sehingga direkomendasikan untuk mengembangkan strategi coping yang efektif dalam menghadapi tekanan."
            else:
                stress_interpretation = "Selisih yang signifikan antara Grafik I dan II dapat mengindikasikan tekanan psikologis yang cukup tinggi; terdapat perbedaan yang nyata antara diri alami testee dan cara testee menampilkan diri di lingkungan, sehingga disarankan untuk melakukan konseling atau evaluasi lebih lanjut mengenai beban kerja dan kesesuaian peran."

            html_content += f"""
<div class="conclusion-box" style="margin-top:0.8rem">
    <strong>Interpretasi Lengkap Profil DISC:</strong> {graph_i_interpretation}. Secara lebih mendalam, {graph_ii_interpretation}. Sementara itu, {graph_iii_interpretation}. Terkait tingkat stres, {stress_interpretation}
</div>
"""

        # -------------------------- TEMPERAMENT --------------------------
        elif test_code == "TEMP" and details:
            raw_scores = details.get('raw_scores', {})
            primary_en = details.get('primary', '')
            secondary_en = details.get('secondary', '')

            # Map English to Indonesian
            en_to_id = {
                "Choleric": "Koleris",
                "Melancholic": "Melankolis",
                "Sanguine": "Sanguin",
                "Phlegmatic": "Plegmatis"
            }
            primary_id = en_to_id.get(primary_en, primary_en)
            secondary_id = en_to_id.get(secondary_en, secondary_en) if secondary_en else None

            # Get raw scores for each trait (assuming keys: C, M, S, P)
            trait_scores = {
                'Koleris': raw_scores.get('C', 0),
                'Melankolis': raw_scores.get('M', 0),
                'Sanguin': raw_scores.get('S', 0),
                'Plegmatis': raw_scores.get('P', 0)
            }

            # Function to get intensity label (max possible per trait = 42)
            def get_intensity_label(score):
                pct = (score / 42) * 100
                if pct >= 70:
                    return "tinggi"
                elif pct >= 30:
                    return "sedang"
                else:
                    return "rendah"

            # Detailed trait meanings (Indonesian)
            trait_meanings = {
                'Koleris': "individu yang bersemangat, tegas, dan berorientasi pada pencapaian. Mereka adalah pemimpin alami yang cepat mengambil keputusan dan tidak takut menghadapi tantangan. Di tempat kerja, mereka sering menjadi penggerak yang mendorong tim menuju target. Namun, mereka perlu waspada terhadap kecenderungan untuk menjadi kurang sabar dan kurang memperhatikan perasaan orang lain. Mereka berkembang dalam lingkungan yang kompetitif dan membutuhkan tantangan baru agar tetap termotivasi.",
                'Melankolis': "individu yang analitis, detail‑orientated, dan perfeksionis. Mereka memiliki standar tinggi dan menghasilkan pekerjaan berkualitas. Mereka unggul dalam tugas yang memerlukan ketelitian dan perencanaan matang. Namun, mereka cenderung terlalu kritis terhadap diri sendiri dan orang lain, serta bisa lambat dalam mengambil keputusan karena terlalu banyak pertimbangan. Mereka membutuhkan apresiasi atas kerja keras mereka dan dukungan untuk lebih fleksibel.",
                'Sanguin': "individu yang sosial, optimis, dan kreatif. Mereka mudah bergaul, pandai membangun hubungan, dan mampu menciptakan suasana kerja yang menyenangkan. Mereka adalah komunikator ulung dan sering menjadi pusat perhatian. Namun, mereka cenderung kurang konsisten, mudah bosan dengan rutinitas, dan bisa mengabaikan detail. Mereka membutuhkan struktur yang jelas dan pengingat untuk tetap fokus pada tugas.",
                'Plegmatis': "individu yang stabil, sabar, dan kooperatif. Mereka adalah pendengar yang baik dan menjaga keharmonisan dalam tim. Mereka tidak suka konflik dan mampu meredakan ketegangan. Namun, mereka cenderung pasif, kurang inisiatif, dan bisa terlalu lambat dalam merespons perubahan. Mereka membutuhkan dorongan untuk lebih proaktif dan pengakuan atas kontribusi mereka yang konsisten."
            }

            # Build conclusion text
            primary_intensity = get_intensity_label(trait_scores[primary_id])
            concl_text = f"Berdasarkan hasil tes, testee menunjukkan dominasi temperament {primary_id} dengan intensitas {primary_intensity}. "
            concl_text += trait_meanings[primary_id] + " "

            if secondary_id:
                secondary_intensity = get_intensity_label(trait_scores[secondary_id])
                concl_text += f"Selain itu, testee juga memiliki kecenderungan sekunder pada {secondary_id} (intensitas {secondary_intensity}) yang memberikan nuansa tambahan pada profil kepribadiannya. "

            concl_text += "Kombinasi ini membentuk karakteristik unik yang perlu dipertimbangkan dalam penempatan peran dan pengembangan."

            # Build categories list for table (using Indonesian names)
            categories = [
                ('Koleris', trait_scores['Koleris']),
                ('Melankolis', trait_scores['Melankolis']),
                ('Sanguin', trait_scores['Sanguin']),
                ('Plegmatis', trait_scores['Plegmatis'])
            ]

            # Start table – no conclusion column, just scores
            html_content += '<table>'
            html_content += '<tr><th>Kategori</th><th>Skor</th></tr>'
            for cat, score in categories:
                is_primary = (primary_id == cat)
                row_class = ' class="primary-row"' if is_primary else ''
                html_content += f'<tr{row_class}><td>{cat}</td><td>{score}</td></tr>'
            html_content += '</table>'

            # Conclusion as a separate block
            html_content += f'<div class="conclusion-box">{concl_text}</div>'

        # -------------------------- PAPI KOSTICK (LEAD) --------------------------
        elif test_code == "LEAD" and details:
            primary_trait = details.get('primary_trait', '')
            html_content += f"""
            <div class="narrative">
                Hasil tes PAPI Kostick menunjukkan profil kepribadian testee berdasarkan 20 norma.
            """
            if primary_trait:
                html_content += f"""
                Norma dengan persentase tertinggi: <strong>{primary_trait}</strong>.
                """
            html_content += f"""
                Hal ini mencerminkan kecenderungan motivasi dan peran testee dalam lingkungan kerja.
            </div>
            """

        # -------------------------- MEMORY -----------------------------
        elif test_code == "MEM" and details:
            correct = details.get('correct_count', 0)
            total = 50
            rating = get_rating(correct, total, test_name)
            pct = int((correct / total) * 100)
            html_content += f"""
            <div class="score-row">
                <span class="score-label">Kemampuan Memori</span>
                <div class="score-bar-wrap">
                    <div class="score-bar" style="width:{pct}%; background:var(--{rating['class']});"></div>
                </div>
                <span class="score-value">{correct}/{total}</span>
            </div>
            <div class="narrative">
                Testee menjawab <strong>{correct}</strong> soal benar dari total {total} soal. 
                Dengan demikian, kemampuan memori dinilai 
                <span class="rating-badge rating-{rating['class']}">{rating['label']}</span>.
                <br>{rating['desc']}
            </div>
            """

        # ----------------------- LOGIC & ARITHMETIC (WPT) --------------------
        elif test_code == "LOGIC" and details:
            correct = details.get('correct_count', 0)
            total = 50
            iq = details.get('est_iq', '-')
            percentile = details.get('percentile', '-')
            classification = details.get('classification', '-')
            recommendation = details.get('recommendation', '-')
            description = details.get('description', '-')

            html_content += f"""
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div style="background: #f1f5f9; padding: 10px; border-radius: 4px;">
                        <div style="font-size: 8pt; font-weight: 600; color: #64748b; text-transform: uppercase;">Estimated IQ</div>
                        <div style="font-size: 14pt; font-weight: 700; color: #1e3a8a;">{iq}</div>
                    </div>
                    <div style="background: #f1f5f9; padding: 10px; border-radius: 4px;">
                        <div style="font-size: 8pt; font-weight: 600; color: #64748b; text-transform: uppercase;">Persentil</div>
                        <div style="font-size: 14pt; font-weight: 700; color: #1e3a8a;">{percentile}</div>
                    </div>
                </div>
                <table>
                    <tr class="primary-row">
                        <td style="width: 30%;">Klasifikasi</td>
                        <td>{classification}</td>
                    </tr>
                    <tr>
                        <td>Deskripsi Kemampuan</td>
                        <td style="font-style: italic; font-size: 9.5pt;">{description}</td>
                    </tr>
                    <tr>
                        <td>Rekomendasi Posisi</td>
                        <td style="font-weight: 600; color: #1e3a8a;">{recommendation}</td>
                    </tr>
                </table>
                <div style="font-size: 8.5pt; color: #64748b; margin-top: 5px;">
                    Skor Mentah: <strong>{correct}</strong> dari {total} soal.
                </div>
            """

        # --------------------------- SPEED -----------------------------
        elif test_code == "SPEED" and details:
            correct = details.get('score', 0)
            total = 100
            rating = get_rating(correct, total, test_name)
            pct = int((correct / total) * 100)
            extra = "Unggul dalam Tekanan Tinggi" if rating['class'] == 'excellent' else ""
            html_content += f"""
            <div class="score-row">
                <span class="score-label">Kecepatan & Akurasi</span>
                <div class="score-bar-wrap">
                    <div class="score-bar" style="width:{pct}%; background:var(--{rating['class']});"></div>
                </div>
                <span class="score-value">{correct}/{total}</span>
            </div>
            <div class="narrative">
                Dari {total} soal Speed Test, testee menjawab <strong>{correct}</strong> soal benar. 
                {('Dengan performa ini, testee dinilai "<strong>' + extra + '</strong>" – unggul dan berkembang di bawah tekanan tinggi. Ideal untuk peran dengan tenggat waktu ketat dan situasi kritis.' if extra else 'Dengan demikian kemampuan kecepatan dan akurasi dinilai <span class="rating-badge rating-' + rating['class'] + '">' + rating['label'] + '</span>.')}
            </div>
            """

        # --------------------------- IQ TEST ---------------------------
        elif test_code == "IQ" and details:
            correct = details.get('correct', 0)
            total = 20
            rating = get_rating(correct, total, test_name)
            pct = int((correct / total) * 100)
            html_content += f"""
            <div class="score-row">
                <span class="score-label">Kemampuan Pola (IQ)</span>
                <div class="score-bar-wrap">
                    <div class="score-bar" style="width:{pct}%; background:var(--{rating['class']});"></div>
                </div>
                <span class="score-value">{correct}/{total}</span>
            </div>
            <div class="narrative">
                Testee berhasil menjawab <strong>{correct}</strong> soal benar dari {total} soal. 
                Kemampuan memahami pola dan berpikir abstrak dinilai 
                <span class="rating-badge rating-{rating['class']}">{rating['label']}</span>.
            </div>
            """

        # ------------------------ FALLBACK ---------------------------
        else:
            max_sc = get_max_score(test_code)
            html_content += f'<div class="narrative">Skor: <strong>{r.score or 0}</strong> / {max_sc if max_sc else "N/A"}</div>'

        html_content += "</div>"  # close test-card

    html_content += f"""
<div class="report-footer">
    <strong>Laporan Dikembangkan oleh Tim Psikologi Andamas</strong> | 
    Data bersifat rahasia dan hanya untuk penggunaan internal. 
    <br>Dicetak pada {id_datefmt(report_date)} – {report_id}
</div>
</body>
</html>
"""
    # Generate PDF
    return HTML(string=html_content).write_pdf()