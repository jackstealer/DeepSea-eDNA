# Basic AWS deployment (EC2 + Caddy HTTPS)

One EC2 instance runs the same `docker compose` stack as local development
(PostgreSQL, Redis, MLflow, FastAPI, nginx frontend). Caddy terminates HTTPS with
automatic Let's Encrypt certificates for two [sslip.io](https://sslip.io) hostnames
derived from the Elastic IP (`app.<ip-with-dashes>.sslip.io`, `api.<...>.sslip.io`),
so no domain is needed and Google sign-in gets the HTTPS URL it requires. Only ports
80/443 are open; MLflow is reachable only through a Session Manager tunnel.
Everything is one CloudFormation stack.

```text
browser ──HTTPS──> EC2 (Elastic IP) ── Caddy :443 ─┬─> frontend (nginx)
                                                   └─> backend (FastAPI) ── MLflow, PostgreSQL, Redis
```

Approximate cost in ap-southeast-2: t3.small about $19/month, plus the public IPv4
address (~$3.60) and 30 GB gp3 disk (~$3).

(CloudFront would be the usual choice for HTTPS, but new accounts must be verified
by AWS Support before they can create CloudFront distributions.)

## 1. Store the secrets in SSM Parameter Store

```bash
export AWS_REGION=ap-southeast-2 P=/deepsea-edna
aws ssm put-parameter --name $P/SECRET_KEY --type SecureString --value "$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
aws ssm put-parameter --name $P/POSTGRES_PASSWORD --type SecureString --value "$(python -c 'import secrets;print(secrets.token_hex(16))')"
aws ssm put-parameter --name $P/ADMIN_EMAILS --type String --value you@example.com
# optional OAuth
aws ssm put-parameter --name $P/GOOGLE_CLIENT_ID --type String --value <client-id>
aws ssm put-parameter --name $P/GOOGLE_CLIENT_SECRET --type SecureString --value <client-secret>
```

## 2. Deploy

```bash
VPC=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query "Vpcs[0].VpcId" --output text)
SUBNET=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query "Subnets[0].SubnetId" --output text)

aws cloudformation create-stack --stack-name deepsea-edna \
  --template-body file://deploy/aws/ec2-stack.yml --capabilities CAPABILITY_IAM \
  --parameters ParameterKey=VpcId,ParameterValue=$VPC ParameterKey=SubnetId,ParameterValue=$SUBNET
aws cloudformation wait stack-create-complete --stack-name deepsea-edna   # ~20-30 min
aws cloudformation describe-stacks --stack-name deepsea-edna --query "Stacks[0].Outputs" --output table
```

The stack completes only once the instance has built the images and both the app and
API answer over HTTPS. Then add the `GoogleRedirectUri` output to your Google OAuth
client's **Authorized redirect URIs**.

## Operate

```bash
# Shell on the instance (no SSH keys or open SSH port)
aws ssm start-session --target <InstanceId>
sudo tail -f /var/log/deepsea-bootstrap.log          # boot/build log
cd /opt/deepsea && sudo docker compose -f docker-compose.yml -f deploy/aws/docker-compose.aws.yml ps

# Update to the latest main
cd /opt/deepsea && sudo git pull && sudo docker compose -f docker-compose.yml -f deploy/aws/docker-compose.aws.yml up -d --build

# MLflow UI at http://localhost:5000 (needs the Session Manager plugin): see the MlflowTunnelCommand output
```

## Remove

```bash
aws cloudformation delete-stack --stack-name deepsea-edna
```

This deletes the instance **and its disk, including all accounts, history and MLflow data**.
SSM parameters are kept; delete them with `aws ssm delete-parameters`.
