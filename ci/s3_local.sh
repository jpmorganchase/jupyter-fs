#!/usr/bin/env bash
S3PROXY_VERSION=1.7.0
S3PROXY_PORT=9000

# Usage info
show_help() {
cat << EOF
Usage: ${0##*/} [-d]
Run a local instance of s3_proxy

    -d    Detach; run s3_proxy as a background job
EOF
}

# parse opts
detach=
OPTIND=1
while getopts hdtr opt; do
    case $opt in
        h)  show_help
            exit 0
            ;;
        d)  detach=-d
            ;;
        *)  show_help >&2
            exit 1
            ;;
    esac
done
shift "$((OPTIND-1))"   # Discard the options and sentinel --

# make dir for storing s3 files locally
mkdir -p s3_local

# create and mount hfs+ disk to use as s3 file store
# S3_LOCAL_DIR=s3_local
# S3_LOCAL_DISK=${S3_LOCAL_DIR}.dmg
# hdiutil create -size 100mb -fs HFS+ -volname $S3_LOCAL_DIR $S3_LOCAL_DISK
# hdiutil attach -noverify -nobrowse -mountpoint $S3_LOCAL_DIR $S3_LOCAL_DISK > /dev/null 2>&1
#hdiutil detach $S3_LOCAL_DIR > /dev/null 2>&1

# make config file for s3proxy
cat <<EOT > s3proxy.conf
s3proxy.authorization=none
s3proxy.endpoint=http://127.0.0.1:${S3PROXY_PORT}
jclouds.provider=filesystem
jclouds.filesystem.basedir=s3_local
EOT

# other config we may potentially need
# s3proxy.authorization=aws-v2-or-v4
# s3proxy.identity=s3_local
# s3proxy.credential=s3_local

# get built s3proxy jar
curl -L https://github.com/gaul/s3proxy/releases/download/s3proxy-${S3PROXY_VERSION}/s3proxy -o s3proxy

# run s3proxy as a background job
if [ "$detach" = "-d" ]; then
    java -jar s3proxy --properties s3proxy.conf &
else
    java -jar s3proxy --properties s3proxy.conf
fi

# no explicit wait needed, azure already stalls
# for 10 seconds to wait for open process to stop

# wait for s3proxy to start up
# sleep 3

# fancy wait-for-startup (from s3proxy repo), doesn't seem to work
# for i in $(seq 30);
# do
#     if exec 3<>"/dev/tcp/localhost/${S3PROXY_PORT}";
#     then
#         exec 3<&-  # Close for read
#         exec 3>&-  # Close for write
#         break
#     fi
#     sleep 1
# done
