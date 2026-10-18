-- Keep sources below the function upload/download payload cap on the selected free host.
update storage.buckets set file_size_limit=4000000 where id='health-records';
