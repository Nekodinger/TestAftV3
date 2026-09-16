/* ============================================================
   Bank soal — 12 MCQ, Cambridge International AS & A Level
   Physics 9702, Paper 4 style.
   Topik: Oscillations (4), Ideal Gases (4), Thermal Properties
   of Materials (4).

   Setiap soal dan angka diambil/diturunkan dari kumpulan soal
   ujian asli (PapaCambridge Paper 4 Topical 2016-2021) dan
   dihitung ulang secara independen agar kunci jawaban akurat.
   correctIndex: indeks 0-based opsi yang benar.
   Field "explanation" TIDAK ditampilkan ke siswa — hanya
   disimpan untuk referensi guru di file ini.
   ============================================================ */
window.EXAM_QUESTIONS = [
  // ---------------- OSCILLATIONS ----------------
  {
    id: "osc1",
    topic: "Oscillations",
    text: "A body undergoes simple harmonic motion. Which statement correctly describes the relationship between its acceleration <em>a</em> and its displacement <em>x</em> from the equilibrium position?",
    options: [
      "<em>a</em> is directly proportional to <em>x</em> and always acts in the same direction as <em>x</em>.",
      "<em>a</em> is directly proportional to <em>x</em> and always acts in the direction opposite to <em>x</em>, towards the equilibrium position.",
      "<em>a</em> is constant in magnitude and always directed towards the equilibrium position.",
      "<em>a</em> is directly proportional to <em>x</em><sup>2</sup> and always directed away from the equilibrium position."
    ],
    correctIndex: 1,
    explanation: "Defining equation of SHM: a = -\u03c9\u00b2x (Cambridge 9702)."
  },
  {
    id: "osc2",
    topic: "Oscillations",
    text: "A trolley of mass 810 g rests on a horizontal surface, held between two identical springs, each of spring constant 64 N m<sup>\u22121</sup>. When the trolley is displaced along the line of the springs and released, its acceleration <em>a</em> is given by a = \u2212(2k/m)x, where <em>x</em> is its displacement from equilibrium. Calculate the frequency of oscillation of the trolley.",
    options: ["1.0 Hz", "2.0 Hz", "4.0 Hz", "12.6 Hz"],
    correctIndex: 1,
    explanation: "\u03c9\u00b2 = 2k/m = 2(64)/0.81 = 158.0; \u03c9 = 12.57 rad/s; f = \u03c9/2\u03c0 = 2.0 Hz. Source: 9702_w16_qp_41/43 Q3 (official 'show that' value)."
  },
  {
    id: "osc3",
    topic: "Oscillations",
    text: "The piston in a car engine cylinder moves with simple harmonic motion between two positions 9.8 cm apart. At one engine speed the piston completes 2700 oscillations per minute. Calculate the maximum speed of the piston.",
    options: ["2.21 m/s", "13.9 m/s", "27.7 m/s", "55.4 m/s"],
    correctIndex: 1,
    explanation: "Amplitude A = 9.8/2 = 4.9 cm = 0.049 m. f = 2700/60 = 45 Hz. v_max = 2\u03c0fA = 2\u03c0(45)(0.049) = 13.9 m/s. Source: 9702_s20_qp_43 Q3."
  },
  {
    id: "osc4",
    topic: "Oscillations",
    text: "A particle oscillates with simple harmonic motion of amplitude <em>A</em>. At what displacement <em>x</em> from the equilibrium position is the kinetic energy of the particle equal to its potential energy?",
    options: ["x = A/2", "x = A/\u221a2", "x = A/4", "x = 0.9A"],
    correctIndex: 1,
    explanation: "KE = \u00bdm\u03c9\u00b2(A\u00b2\u2212x\u00b2), PE = \u00bdm\u03c9\u00b2x\u00b2. Equal when A\u00b2\u2212x\u00b2 = x\u00b2, i.e. x = A/\u221a2 \u2248 0.71A."
  },

  // ---------------- IDEAL GASES ----------------
  {
    id: "gas1",
    topic: "Ideal Gases",
    text: "Which assumption of the kinetic theory of gases relates specifically to the volume occupied by the molecules of an ideal gas?",
    options: [
      "The molecules move in random directions with a range of speeds.",
      "The duration of a collision is negligible compared with the time between collisions.",
      "The volume of the molecules themselves is negligible compared with the volume occupied by the gas.",
      "There are no forces of attraction between molecules except during collisions."
    ],
    correctIndex: 2,
    explanation: "Source: 9702_w19_qp_41/43 Q2(a)."
  },
  {
    id: "gas2",
    topic: "Ideal Gases",
    text: "An ideal gas occupies a volume of 2.40 \u00d7 10<sup>\u22122</sup> m<sup>3</sup> at a pressure of 4.60 \u00d7 10<sup>5</sup> Pa and a temperature of 23 \u00b0C. Using <em>pV</em> = <em>NkT</em> with the Boltzmann constant <em>k</em> = 1.38 \u00d7 10<sup>\u221223</sup> J K<sup>\u22121</sup>, calculate the number of molecules in the gas.",
    options: ["2.70 \u00d7 10\u00b2\u00b2", "2.70 \u00d7 10\u00b2\u00b3", "2.70 \u00d7 10\u00b2\u2074", "2.70 \u00d7 10\u00b2\u2075"],
    correctIndex: 2,
    explanation: "N = pV/kT = (4.60e5 \u00d7 2.40e-2)/(1.38e-23 \u00d7 296) = 2.70 \u00d7 10^24. Source: 9702_w19_qp_41/43 Q2(b)(i) — official answer matches."
  },
  {
    id: "gas3",
    topic: "Ideal Gases",
    text: "An ideal gas is at a temperature of 21 \u00b0C. Each molecule of the gas has a mass of 40 u (1 u = 1.66 \u00d7 10<sup>\u221227</sup> kg). Using E<sub>K</sub> = \u00b3\u2044\u2082<em>kT</em> for the mean translational kinetic energy of a molecule, calculate the root-mean-square speed of the molecules.",
    options: ["214 m/s", "302 m/s", "428 m/s", "605 m/s"],
    correctIndex: 2,
    explanation: "\u27e8c\u00b2\u27e9 = 3kT/m = 3(1.38e-23)(294)/(6.64e-26) = 1.833 \u00d7 10^5 m\u00b2/s\u00b2; rms speed = 428 m/s. Adapted from 9702_m21_qp_42 Q2 — verified independently."
  },
  {
    id: "gas4",
    topic: "Ideal Gases",
    text: "A cylinder of volume 2.4 \u00d7 10<sup>3</sup> cm<sup>3</sup> contains 2.3 \u00d7 10<sup>23</sup> molecules of an ideal gas. Assuming each molecule occupies a cube of volume V/N, estimate the mean distance between the centres of adjacent molecules.",
    options: ["2.2 \u00d7 10\u207b\u00b9 m", "1.0 \u00d7 10\u207b\u00b2\u2076 m", "2.2 \u00d7 10\u207b\u2079 m", "4.5 \u00d7 10\u207b\u2078 m"],
    correctIndex: 2,
    explanation: "V/N = (2.4e-3)/(2.3e23) = 1.04 \u00d7 10^-26 m\u00b3 per molecule; cube root = 2.19 \u00d7 10^-9 m. Source: 9702_w16_qp_42 Q2(c)."
  },

  // ---------------- THERMAL PROPERTIES ----------------
  {
    id: "th1",
    topic: "Thermal Properties of Materials",
    text: "An aluminium can of mass 160 g contains 330 g of warm water at 38 \u00b0C. A 48 g piece of ice at \u221218 \u00b0C is added, melts completely, and the final temperature of the can and its contents is 23 \u00b0C. The loss in thermal energy of the can and the water is 2.3 \u00d7 10<sup>4</sup> J. Given specific heat capacities of aluminium = 0.910 J g<sup>\u22121</sup> K<sup>\u22121</sup>, ice = 2.10 J g<sup>\u22121</sup> K<sup>\u22121</sup> and water = 4.18 J g<sup>\u22121</sup> K<sup>\u22121</sup>, calculate the specific latent heat of fusion <em>L</em> of ice.",
    options: ["343 J g\u207b\u00b9", "380 J g\u207b\u00b9", "439 J g\u207b\u00b9", "477 J g\u207b\u00b9"],
    correctIndex: 0,
    explanation: "22875 = (48\u00d72.10\u00d718) + 48L + (48\u00d74.18\u00d723) \u2192 L = 342.6 \u2248 343 J/g. Source: 9702_s18_qp_42 Q3(b). Distractors reflect omitting one warming term."
  },
  {
    id: "th2",
    topic: "Thermal Properties of Materials",
    text: "A block of aluminium of mass 670 g is heated at a constant rate of 95 W for 6.0 minutes. The specific heat capacity of aluminium is 910 J kg<sup>\u22121</sup> K<sup>\u22121</sup> and the initial temperature of the block is 24 \u00b0C. Assuming no thermal energy is lost to the surroundings, calculate the final temperature of the block.",
    options: ["56 \u00b0C", "80 \u00b0C", "91 \u00b0C", "104 \u00b0C"],
    correctIndex: 1,
    explanation: "Q = Pt = 95\u00d7360 = 34200 J. \u0394T = Q/mc = 34200/(0.670\u00d7910) = 56.1 K. Final = 24+56.1 = 80 \u00b0C. Source: 9702_w17_qp_41/43 Q1(c) — official 'show that' value."
  },
  {
    id: "th3",
    topic: "Thermal Properties of Materials",
    text: "The specific latent heat of vaporisation of a substance is much greater than its specific latent heat of fusion. What is the best explanation for this, in terms of the spacing of molecules?",
    options: [
      "Vaporisation always happens at a higher temperature, so more energy is needed regardless of molecular spacing.",
      "During melting the average separation of molecules increases only slightly; during boiling it increases very greatly, so far more work must be done against intermolecular attractive forces.",
      "Latent heat of vaporisation includes extra kinetic energy needed to speed up the molecules, while latent heat of fusion does not.",
      "Gas molecules possess a fixed vibrational energy that liquid and solid molecules do not have."
    ],
    correctIndex: 1,
    explanation: "Adapted from 9702_m21_qp_42 Q3(b)."
  },
  {
    id: "th4",
    topic: "Thermal Properties of Materials",
    text: "A solid metal ball falls freely under gravity through a vacuum, with no change of temperature. What happens to the internal energy of the ball as it falls?",
    options: [
      "It increases, because the ball's kinetic energy increases.",
      "It decreases, because the ball's gravitational potential energy decreases.",
      "It stays constant, because internal energy depends on the random kinetic and potential energies of the molecules, which are unaffected by the ball's bulk motion.",
      "It stays constant only momentarily, then increases just before impact."
    ],
    correctIndex: 2,
    explanation: "Adapted from 9702_s20_qp_41/43 Q2(c). Bulk mechanical KE \u2260 internal energy."
  }
];
