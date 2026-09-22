import os
import pandas as pd
import numpy as np
from collections import defaultdict
from tqdm import tqdm

def main():
    # Detect running path and set DATA_DIR
    if os.path.exists('data/processed/y_train.csv'):
        DATA_DIR = 'data/processed'
    elif os.path.exists('../../../data/processed/y_train.csv'):
        DATA_DIR = '../../../data/processed'
    else:
        raise FileNotFoundError("Could not find data/processed directory")

    TARGET_SAMPLES = 75000
    CHUNK_SIZE = 100000

    print(f"Starting hybrid resampling (Target: {TARGET_SAMPLES} samples per class)")

    # 1. Read y_train.csv to find indices for each class
    print("Reading y_train.csv...")
    y_train = pd.read_csv(os.path.join(DATA_DIR, "y_train.csv"))
    y_train_multi = y_train["Label_Multiclass"].values

    class_indices = defaultdict(list)
    for idx, label in enumerate(y_train_multi):
        class_indices[label].append(idx)

    # 2. Sample TARGET_SAMPLES for each class
    np.random.seed(42)
    sampled_indices_flat = []
    print("Sampling indices for each class...")
    for label, indices in class_indices.items():
        count = len(indices)
        if count >= TARGET_SAMPLES:
            # Undersample
            sampled = np.random.choice(indices, TARGET_SAMPLES, replace=False)
        else:
            # Oversample
            sampled = np.random.choice(indices, TARGET_SAMPLES, replace=True)
        sampled_indices_flat.extend(sampled)

    # 3. Create a mapping of original_index -> count to know how many times to repeat each row
    print("Counting index frequencies...")
    index_counts = pd.Series(sampled_indices_flat).value_counts().to_dict()

    # 4. Stream X_train.csv and y_train.csv in chunks and write balanced datasets
    print("Creating balanced datasets...")
    X_in = os.path.join(DATA_DIR, "X_train.csv")
    y_in = os.path.join(DATA_DIR, "y_train.csv")
    X_out = os.path.join(DATA_DIR, "X_train_balanced.csv")
    y_out = os.path.join(DATA_DIR, "y_train_balanced.csv")

    # Clear output files if they exist
    if os.path.exists(X_out):
        os.remove(X_out)
    if os.path.exists(y_out):
        os.remove(y_out)

    X_chunker = pd.read_csv(X_in, chunksize=CHUNK_SIZE)
    y_chunker = pd.read_csv(y_in, chunksize=CHUNK_SIZE)

    total_written = 0
    first_chunk = True

    with tqdm(total=len(y_train)) as pbar:
        # Iterate with global row index tracking
        current_idx = 0
        for X_chunk, y_chunk in zip(X_chunker, y_chunker):
            chunk_len = len(X_chunk)
            # Create an array of indices for the current chunk
            chunk_indices = np.arange(current_idx, current_idx + chunk_len)
            X_chunk.index = chunk_indices
            y_chunk.index = chunk_indices
            
            # Find which indices in this chunk are needed and how many times
            needed_indices = [idx for idx in chunk_indices if idx in index_counts]
            
            if needed_indices:
                # Repeat the rows according to their count
                repeat_indices = []
                for idx in needed_indices:
                    repeat_indices.extend([idx] * index_counts[idx])
                    
                X_out_chunk = X_chunk.loc[repeat_indices]
                y_out_chunk = y_chunk.loc[repeat_indices]
                
                X_out_chunk.to_csv(X_out, mode='a', header=first_chunk, index=False)
                y_out_chunk.to_csv(y_out, mode='a', header=first_chunk, index=False)
                first_chunk = False
                total_written += len(X_out_chunk)
                
            current_idx += chunk_len
            pbar.update(chunk_len)

    print(f"Total samples written: {total_written}")
    print("Shuffling balanced dataset in memory...")
    # Load the balanced dataset, shuffle it, and save it
    X_bal = pd.read_csv(X_out)
    y_bal = pd.read_csv(y_out)

    shuffle_idx = np.random.permutation(len(X_bal))
    X_bal = X_bal.iloc[shuffle_idx]
    y_bal = y_bal.iloc[shuffle_idx]

    X_bal.to_csv(X_out, index=False)
    y_bal.to_csv(y_out, index=False)

    print("Balanced datasets created and shuffled successfully!")

if __name__ == "__main__":
    main()
