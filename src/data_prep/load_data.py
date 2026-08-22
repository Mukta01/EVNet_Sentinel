import os
import tarfile
import gdown
from dotenv import load_dotenv

def load_data():
    """
    Downloads the dataset from Google Drive (if not present) and extracts the .tar.xz archive
    into the data/raw/ directory.
    """
    load_dotenv()
    
    dataset_url = os.getenv("CICEVSE2024_DATASET_URL")
    if not dataset_url:
        print("ERROR: CICEVSE2024_DATASET_URL environment variable is not set.")
        print("Please ask a team admin for the dataset link and add it to your .env file.")
        return

    # Directories
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    raw_dir = os.path.join(project_root, "data", "raw")
    os.makedirs(raw_dir, exist_ok=True)
    
    # Check if data already exists
    # If the unzipped directory or a significant file exists, skip
    # (Assuming the extracted folder might be named Dataset_EVNetsentinel)
    extracted_folder_path = os.path.join(raw_dir, "Dataset_EVNetsentinel")
    if os.path.exists(extracted_folder_path):
        print(f"Dataset appears to already be extracted at {extracted_folder_path}.")
        return

    archive_path = os.path.join(raw_dir, "dataset.tar.xz")
    
    if not os.path.exists(archive_path):
        print(f"Downloading dataset from Google Drive...")
        print(f"URL: {dataset_url}")
        print(f"Destination: {archive_path}")
        
        # Use gdown to handle large Google Drive files
        gdown.download(dataset_url, archive_path, quiet=False, fuzzy=True)
        
        if not os.path.exists(archive_path):
            print("ERROR: Download failed.")
            return
            
    print(f"Extracting {archive_path}...")
    
    try:
        with tarfile.open(archive_path, "r:xz") as tar:
            tar.extractall(path=raw_dir)
        print("Extraction complete!")
    except Exception as e:
        print(f"ERROR during extraction: {e}")

if __name__ == "__main__":
    load_data()
