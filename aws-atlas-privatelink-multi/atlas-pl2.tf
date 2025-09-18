resource "aws_vpc_endpoint" "ptfe_service2" {
  vpc_id             = aws_vpc.primary.id
  service_name       = mongodbatlas_privatelink_endpoint.atlaspl.endpoint_service_name
  vpc_endpoint_type  = "Interface"
  subnet_ids         = [aws_subnet.primary-az1.id, aws_subnet.primary-az2.id]
  security_group_ids = [aws_security_group.primary_default.id]
}
resource "mongodbatlas_privatelink_endpoint_service" "atlaseplink2" {
  project_id          = mongodbatlas_privatelink_endpoint.atlaspl.project_id
  private_link_id     = mongodbatlas_privatelink_endpoint.atlaspl.private_link_id
  endpoint_service_id = aws_vpc_endpoint.ptfe_service2.id
  provider_name       = "AWS"
}
