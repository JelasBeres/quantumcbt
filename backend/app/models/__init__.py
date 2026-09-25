from .base import Base

# Import all model modules so that they are registered on the metadata
from . import user
from . import siswa
from . import program
from . import pelajaran
from . import kelas
from . import topik
from . import subbab
from . import paket_ujian
from . import kategori_paket
from . import bagian_paket
from . import paket_mapel
from . import paket_soal
from . import soal
from . import pernyataan_benar_salah
from . import opsi_jawaban
from . import jadwal_ujian
from . import ujian_siswa
from . import jawaban_siswa
from . import hasil_ujian
from . import log_kecurangan
from . import laporan_soal
from . import pengaturan
from . import login_activity
from . import auth_session
from . import login_attempt
from . import guru_scope
from . import guru
from . import soal_review_history
from . import pemberitahuan

__all__ = [
    "Base",
]
