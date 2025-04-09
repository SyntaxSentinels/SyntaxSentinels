#formerly compute.py
import os
import tempfile
import zipfile
from controller.algorithms.abstract_report_generation import abstract_report_generation
from controller.algorithms.v1_sim_score import *

class report_generation(abstract_report_generation):
    def generate(self, data):
        data = extract_python_files_from_zip(data)
        results = basic_weighting().score(data)
        return results


def extract_python_files_from_zip(zip_bytes):
    """
    Given the bytes of a zip file, extract all .py files and return a list of tuples:
      [(filename, file_content), ...]
    """
    python_files = []
    with tempfile.TemporaryDirectory() as tmpdirname:
        zip_path = os.path.join(tmpdirname, "upload.zip")
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)
        with zipfile.ZipFile(zip_path, 'r') as zf:
            for info in zf.infolist():
                if info.filename.endswith(".py") and not info.is_dir():
                    with zf.open(info) as file:
                        content = file.read().decode("utf-8")
                        python_files.append((info.filename, content))
    return python_files


