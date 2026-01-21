import csv
import re
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from collections import Counter
from datetime import datetime
import calendar
from dateutil import parser as dateutil_parser
from typing import Tuple, Dict, Any, Optional
import warnings

# Read the CSV file
# df = pd.read_csv("student_data.csv")


# Standardize column names
def normalize_columns(df):
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    df.columns = [c.strip().lower() for c in df.columns]
    return df

# Remove duplicates based on specific columns (example: 'id', 'name', 'dob')
def remove_duplicates(df):
    columns_to_check = [c for c in ['id', 'name'] if c in df.columns]
    if columns_to_check:
        df = df.drop_duplicates(subset=columns_to_check, keep='first')
    else:
        df = df.drop_duplicates(keep='first')
    return df.reset_index(drop=True)



#show the dataset
 
def split_order(order: Any) -> Tuple[str, Optional[int], str, int]:
    if pd.isna(order):
        return ("", None, "", 0)
    s = str(order)
    m = re.search(r"(\d+)", s)
    if m:
        num_str = m.group(1)
        prefix = s[:m.start(1)]
        suffix = s[m.end(1):]
        return (prefix, int(num_str), suffix, len(num_str))
    else:
        return (s, None, "", 0)


def clean_id_column(
    series: pd.Series,
    mode: str = "fill",
    start_at: int = 1,
    pad_width: Optional[int] = None,
    prefer_prefix_threshold: float = 0.6
) -> pd.Series:
    
    parsed = [split_order(x) for x in series]
    nums = [n for _, n, _, _ in parsed if n is not None]
    lengths = [ln for _, n, _, ln in parsed if n is not None]

    if nums:
        # choose prefix
        prefix_counts = Counter([p for p, n, _, _ in parsed if n is not None])
        chosen_prefix = prefix_counts.most_common(1)[0][0]

        # choose suffix
        suffix_counts = Counter([s for _, n, s, _ in parsed if n is not None])
        chosen_suffix = suffix_counts.most_common(1)[0][0]

        max_len = max(lengths) if lengths else 0
        if pad_width is None:
            pad_width = max_len

        start_num = max(start_at, min(nums))

    else:
        chosen_prefix = ""
        chosen_suffix = ""
        if pad_width is None:
            pad_width = 0
        start_num = start_at

    def fmt(n):
        return str(n).zfill(pad_width) if pad_width and pad_width > 0 else str(n)

    # sequence mode
    if mode == "sequence":
        seq = []
        current = start_num
        for _ in range(len(series)):
            seq.append(f"{chosen_prefix}{fmt(current)}{chosen_suffix}")
            current += 1
        return pd.Series(seq, index=series.index)

    # fill mode
    out = series.astype(object).copy()
    used_nums = set()

    # collect existing numbers
    for prefix, num, suffix, _ in parsed:
        if num is not None and suffix == chosen_suffix:
            used_nums.add(num)

    next_num = start_num

    def next_unused():
        nonlocal next_num
        while next_num in used_nums:
            next_num += 1
        val = next_num
        used_nums.add(val)
        next_num += 1
        return val

    seen = set()

    for idx, (prefix, num, suffix, ln) in enumerate(parsed):
        if num is None:
            assigned = next_unused()
            out.iloc[idx] = f"{chosen_prefix}{fmt(assigned)}{chosen_suffix}"
        else:
            label = f"{prefix}::{num}::{suffix}"
            if label in seen:
                assigned = next_unused()
                out.iloc[idx] = f"{chosen_prefix}{fmt(assigned)}{chosen_suffix}"
            else:
                seen.add(label)
                if pad_width and ln != pad_width:
                    out.iloc[idx] = f"{prefix}{fmt(num)}{suffix}"
                else:
                    out.iloc[idx] = series.iloc[idx]

    return out.astype(str)


def detect_id_columns(df: pd.DataFrame, candidate_regex: Optional[str] = None):
    if candidate_regex is None:
        candidate_regex = r'\b(id|studentid|student_id|order|orderno|order_no|emp_id|empid|reg|regno|reg_no|num|number|code|ref)\b'
    return [col for col in df.columns if re.search(candidate_regex, col, flags=re.I)]


def auto_fix_id_columns(df: pd.DataFrame, mode="fill", **clean_kwargs):
    df_out = df.copy()
    id_cols = detect_id_columns(df_out)
    for col in id_cols:
        df_out[col] = clean_id_column(df_out[col], mode=mode, **clean_kwargs)
    return df_out

# output in cleaning data
def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    df = auto_fix_id_columns(df, mode="fill", start_at=1)
    return df
# ======================================================================================================
def clean_gender_inplace(df):
    if df is None:
        print("DataFrame is None!")
        return None

    # Fill missing values
    df = df.fillna("")

    # Standardize column names
    df.columns = [c.strip().lower() for c in df.columns]

    # Auto-detect gender column
    gender_col = next((c for c in df.columns if "gender" in c or "sex" in c), None)
    if not gender_col:
        raise ValueError("No gender column found")

    # Define mappings
    male_values = {"m", "male", "boy", "man"}
    female_values = {"f", "female", "girl", "woman"}

    # Clean function
    def normalize_gender(x):
        x = str(x).strip().lower()
        if x in male_values:
            return "Male"
        if x in female_values:
            return "Female"
        # Common mistakes
        if x.startswith("m"):
            return "Male"
        if x.startswith("f"):
            return "Female"
        return "Unknown"

    df[gender_col] = df[gender_col].apply(normalize_gender)
    return df
def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    clean_gender = clean_gender_inplace(df)
    return df
# ==================================================================================================
def clean_dob_age_pair(
    df_in: pd.DataFrame,
    dob_col: Optional[str] = None,
    age_col: Optional[str] = None,
    today: Optional[pd.Timestamp] = None,
    fallback_month: int = 1,
    fallback_day: int = 1,
    prefer_dayfirst: Optional[bool] = None,
    max_reasonable_age: int = 120,
    drop_missing_both: bool = False
) -> pd.DataFrame:
    
    if df_in is None:
        raise ValueError("Input DataFrame is None")

    warnings.filterwarnings("ignore", category=UserWarning, message="Parsing dates")

    df = df_in.copy()
    cols = list(df.columns)

    # Detect columns if not given
    if dob_col is None:
        dob_candidates = [c for c in cols if 'dob' in c.lower() or 'birth' in c.lower()]
        dob_col = dob_candidates[0] if dob_candidates else None

    if age_col is None:
        age_candidates = [c for c in cols if 'age' in c.lower() and 'stage' not in c.lower()]
        age_col = age_candidates[0] if age_candidates else None

    if dob_col is None and age_col is None:
        raise ValueError("Both DOB and Age columns are missing. Provide at least one.")

    # prepare 'today'
    if today is None:
        today = pd.to_datetime("today").normalize()
    else:
        today = pd.to_datetime(today).normalize()

    # create placeholders if needed
    created_dob_placeholder = False
    created_age_placeholder = False
    if dob_col is None:
        df["__dob_temp__"] = pd.NA
        dob_col = "__dob_temp__"
        created_dob_placeholder = True
    else:
        df[dob_col] = df[dob_col].replace(r'^\s*$', pd.NA, regex=True)

    if age_col is None:
        df["__age_temp__"] = pd.NA
        age_col = "__age_temp__"
        created_age_placeholder = True

    # coerce age numeric
    df[age_col] = pd.to_numeric(df[age_col], errors="coerce")

    # Robust parsing with dayfirst heuristic
    def try_parse_dayfirst(flag: bool):
        return pd.to_datetime(df[dob_col], errors="coerce", dayfirst=flag)

    parsed_true = try_parse_dayfirst(True)
    parsed_false = try_parse_dayfirst(False)

    if prefer_dayfirst is None:
        chosen_dayfirst = True if parsed_true.notna().sum() >= parsed_false.notna().sum() else False
    else:
        chosen_dayfirst = bool(prefer_dayfirst)

    parsed = parsed_true if chosen_dayfirst else parsed_false

    # dateutil fallback for remaining raw values
    raw = df[dob_col].astype("object")
    mask_fallback = parsed.isna() & raw.notna()
    if mask_fallback.any():
        for idx in df.index[mask_fallback]:
            try:
                parsed_val = dateutil_parser.parse(str(raw.loc[idx]), dayfirst=chosen_dayfirst)
                parsed.loc[idx] = pd.to_datetime(parsed_val)
            except Exception:
                parsed.loc[idx] = pd.NaT

    df["_dob_parsed"] = pd.to_datetime(parsed).dt.normalize()

    # Majority month/day (or fallback)
    valids = df["_dob_parsed"].dropna()
    if not valids.empty:
        month_mode = int(valids.dt.month.mode()[0])
        day_mode  = int(valids.dt.day.mode()[0])
    else:
        month_mode = int(fallback_month) if 1 <= fallback_month <= 12 else 1
        day_mode  = int(fallback_day)  if 1 <= fallback_day <= 28 else 1

    # Infer DOB from Age where DOB missing
    mask_infer = df["_dob_parsed"].isna() & df[age_col].notna()
    if mask_infer.any():
        inferred_dates = []
        for idx, age_val in df.loc[mask_infer, age_col].items():
            try:
                a = int(age_val)
                yr = int(today.year - a)
                last_day = calendar.monthrange(yr, month_mode)[1]
                safe_day = min(day_mode, last_day)
                inferred_dates.append(pd.Timestamp(datetime(yr, month_mode, safe_day)))
            except Exception:
                inferred_dates.append(pd.NaT)
        df.loc[mask_infer, "_dob_parsed"] = inferred_dates

    # Optionally drop rows missing both
    if drop_missing_both:
        mask_drop = df["_dob_parsed"].isna() & df[age_col].isna()
        if mask_drop.any():
            df = df.loc[~mask_drop].copy()
            df.reset_index(drop=True, inplace=True)

    # Calculate age from DOB
    def calc_age(dt):
        if pd.isna(dt):
            return pd.NA
        dt = pd.to_datetime(dt)
        a = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
        return int(a)

    df["__calc_age__"] = df["_dob_parsed"].apply(calc_age)

    # Fill missing ages with calculated age
    df[age_col] = df[age_col].fillna(df["__calc_age__"])

    # Replace unrealistic ages (if any) with calculated age where possible
    unrealistic_mask = df[age_col].notna() & ((df[age_col] < 0) | (df[age_col] > max_reasonable_age))
    if unrealistic_mask.any():
        df.loc[unrealistic_mask, age_col] = df.loc[unrealistic_mask, "__calc_age__"]

    # Finalize age column as nullable Int
    df[age_col] = pd.to_numeric(df[age_col], errors="coerce").astype("Int64")

    # Overwrite DOB with parsed values
    df[dob_col] = df["_dob_parsed"]

    # Drop helper columns
    df.drop(columns=["_dob_parsed", "__calc_age__"], inplace=True, errors="ignore")

    # remove placeholder columns if created
    if created_dob_placeholder and "__dob_temp__" in df.columns:
        df.drop(columns=["__dob_temp__"], inplace=True, errors="ignore")
    if created_age_placeholder and "__age_temp__" in df.columns:
        df.drop(columns=["__age_temp__"], inplace=True, errors="ignore")

    return df

# output is cleaning data
def clean_dataset(df: pd.DataFrame ) -> pd.DataFrame:
    clean_dob_age = clean_dob_age_pair(df, drop_missing_both=True)
    return df
 

def clean_emails_inplace_df(df, email_col=None, name_col=None, default_domain="gmail.com"):

    df = df.fillna("")

    # Standardize column names
    orig_columns = list(df.columns)
    df.columns = [c.strip().lower() for c in df.columns]

    # Detect or create email column
    if email_col:
        email_col = email_col.strip().lower()
    else:
        email_col = next((c for c in df.columns if "mail" in c or "email" in c), None)

    if not email_col:
        email_col = "email"
        df[email_col] = ""

    # Detect name column
    if name_col:
        name_col = name_col.strip().lower()
    else:
        name_col = next((c for c in df.columns if "name" in c and "full" not in c), None)

        # fallback using first/last name
        if not name_col:
            first = next((c for c in df.columns if c in ("first_name", "firstname", "first")), None)
            last = next((c for c in df.columns if c in ("last_name", "lastname", "last")), None)

            if first and last:
                name_col = "name_from_parts"
                df[name_col] = (df[first].astype(str).str.strip() + " " + df[last].astype(str).str.strip()).str.strip()
            elif first:
                name_col = first
            elif last:
                name_col = last
            else:
                name_col = "name"
                df[name_col] = df[name_col].replace("", "unknown")

    # Clean existing emails
    df[email_col] = df[email_col].astype(str).str.lower().str.strip()
    email_re = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$")
    df.loc[~df[email_col].str.match(email_re), email_col] = ""

    # Detect majority domain
    valid_domains = (
        df[df[email_col] != ""][email_col]
        .apply(lambda x: x.split("@")[1])
        .tolist()
    )
    majority_domain = pd.Series(valid_domains).mode()[0] if valid_domains else default_domain

    used_emails = set(df[df[email_col] != ""][email_col])

   
    def _make_username_from_name(name):
        cleaned = re.sub(r"[^a-zA-Z\s]", "", str(name)).strip().lower()
        parts = [p for p in cleaned.split() if p]

        if not parts:
            return "unknown"
        if len(parts) == 1:
            return parts[0]

        # ❗ Join firstname + lastname with NO dot
        return "".join(parts)

    def generate_email_from_name(name):
        username = _make_username_from_name(name)
        base = username

        candidate = f"{username}@{majority_domain}"
        if candidate not in used_emails:
            used_emails.add(candidate)
            return candidate

        # If exists, append numbers
        i = 2
        while True:
            candidate2 = f"{base}{i}@{majority_domain}"
            if candidate2 not in used_emails:
                used_emails.add(candidate2)
                return candidate2
            i += 1

    df[email_col] = df.apply(
        lambda r: generate_email_from_name(r[name_col]) if r[email_col] == "" else r[email_col],
        axis=1
    )

    return df

def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    clean_mail = clean_emails_inplace_df(df)
    return df
 


def clean_attendance_inplace(df):
    if df is None:
        print("DataFrame is None!")
        return None

    # Fill missing values with empty string
    df = df.fillna("")

    # Standardize column names
    df.columns = [c.strip().lower() for c in df.columns]

    # Detect attendance column
    att_col = next((c for c in df.columns if "attendance" in c), None)
    if not att_col:
        print("No attendance column found.")
        return df

    def clean_value(val):
        # --- Convert to string for safe checks ---
        if val is None:
            return None
        
        val_str = str(val).strip()

        if val_str == "":
            return None

        # Handle fractions like "85/100"
        if "/" in val_str:
            try:
                num, denom = val_str.split("/")
                return (float(num) / float(denom)) * 100
            except:
                return None

        # Remove % or non-numeric characters
        val_str = re.sub(r"[^\d.]", "", val_str)

        try:
            num = float(val_str)
            # Clamp between 0 and 100
            return max(0, min(num, 100))
        except:
            return None

    # Apply cleaning
    df[att_col] = df[att_col].apply(clean_value)

    # Fill missing with minimum valid attendance
    min_att = df[att_col].min()
    df[att_col] = df[att_col].fillna(min_att)

    # Convert to string with percentage symbol
    df[att_col] = df[att_col].apply(lambda x: f"{round(x, 2)}%")

    return df

# output is cleaning data
def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    clean_attendance = clean_attendance_inplace(df)
    return df
 

def detect_score_columns(df):
    keywords = ['mark', 'gpa', 'cgpa', 'percent', '%']
    return [col for col in df.columns if any(k in col.lower() for k in keywords)]

# Clean and fix scores, then add % symbol for percentage columns
def clean_marks_columns(df):
    score_cols = detect_score_columns(df)
    
    for col in score_cols:
        # Remove %, NA, empty etc.
        df[col] = df[col].astype(str).str.replace('%','').replace({'NA':'', 'nan':'', 'none':'', '-':''})
        # Convert to numeric
        df[col] = pd.to_numeric(df[col], errors='coerce')
        # Fill missing with 0
        df[col] = df[col].fillna(0)
        
        # Clip values
        if 'gpa' in col.lower() or 'cgpa' in col.lower():
            df[col] = df[col].clip(upper=4)  # GPA max 4
        else:
            df[col] = df[col].clip(upper=100)  # Marks/percent max 100
            # Add % symbol
            df[col] = df[col].astype(int).astype(str) + '%'
    
    return df

# Apply
def clean_dataset (df: pd.DataFrame ) -> pd.DataFrame:
    clean_marks = clean_marks_columns(df)
    return df
 

def detect_date_columns(df, keywords=None):
    if keywords is None:
        keywords = ["date", "join", "joining", "st_date", "end_date", "relieve"]

    found = []
    for col in df.columns:
        lower = col.lower()
        if any(key in lower for key in keywords):
            found.append(col)
    return found

def clean_date_columns(df, date_columns=None):
    df = df.copy()

    # Auto-detect if user didn't provide
    if date_columns is None:
        date_columns = detect_date_columns(df)

    for col in date_columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
            valid_dates = df[col].dropna()

            if not valid_dates.empty:
                majority_year = int(valid_dates.dt.year.mode()[0])
                majority_month = int(valid_dates.dt.month.mode()[0])
                majority_day = int(valid_dates.dt.day.mode()[0])

                df[col] = df[col].fillna(
                    pd.Timestamp(
                        year=majority_year,
                        month=majority_month,
                        day=majority_day
                    )
                )
    return df

def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    clean_join_date = clean_date_columns(df)
    return df
 

def clean_date_formate(df):
    # Auto-detect columns with "date" in their name
    date_cols = [col for col in df.columns if "date" in col.lower()]

    for col in date_cols:
        # Convert to datetime, coerce invalid/missing -> NaT
        df[col] = pd.to_datetime(df[col], errors="coerce")

        if df[col].notna().sum() >= 2:  # need at least a start & end
            # Get first and last valid date
            start_date = df[col].min()
            end_date = df[col].max()

            # Generate full date range of same length as df
            full_range = pd.date_range(start=start_date, end=end_date, periods=len(df))

            # Fill missing values in order
            df[col] = df[col].fillna(pd.Series(full_range, index=df.index))

    return df

# output is cleaning data
def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    clean_date = clean_date_formate(df)
    return df

def clean_nan_other_columns(df):
    df = df.copy()

    # Keywords to detect important columns
    keywords = [
        "name", "salary", "mark", "price", "quantity",
        "revenue", "open", "close", "temperature",
        "humidity", "condition"
    ]

    # Columns that MATCH keywords → mandatory columns (DO NOT use for row dropping)
    mandatory_cols = [col for col in df.columns if any(k in col.lower() for k in keywords)]

    # All other columns → if NaN/empty remove row
    other_cols = [col for col in df.columns if col not in mandatory_cols]

    # Clean rows: remove where OTHER columns have NaN or empty
    for col in other_cols:
        df = df[df[col].notna() & (df[col].astype(str).str.strip() != "")]

    # Reset index
    df = df.reset_index(drop=True)
    return df

def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    clean_nan = clean_nan_other_columns(df)
    return df

def convert_datetime_to_string(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.strftime("%Y-%m-%d")
    return df



def run_full_cleaning_pipeline(df, output_csv="cleaned_output.csv"):
    # run each cleaner in order
    df = auto_fix_id_columns(df)
    df = clean_gender_inplace(df)
    df = clean_dob_age_pair(df)
    df = clean_emails_inplace_df(df)
    df = clean_attendance_inplace(df)
    df = clean_marks_columns(df)
    df = clean_date_columns(df)
    df = clean_date_formate(df)
    df = clean_nan_other_columns(df)
    df = convert_datetime_to_string(df)

    # save to CSV
    df.to_csv(output_csv, index=False)

    return df
    
def clean_dataset(df):
    # normalize columns
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    df.columns = [c.strip().lower() for c in df.columns]

    # remove duplicates
    columns_to_check = [c for c in ['id', 'name'] if c in df.columns]
    if columns_to_check:
        df = df.drop_duplicates(subset=columns_to_check, keep='first')
    else:
        df = df.drop_duplicates(keep='first')

    df = df.reset_index(drop=True)

    # run full pipeline
    df = run_full_cleaning_pipeline(df)

    return df